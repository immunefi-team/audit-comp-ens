import {
  type Web3ProviderBackend,
  Web3RequestKind,
} from '@ensdomains/headless-web3-provider'
import { expect, type Page } from '@playwright/test'
import type { Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ---------------------------------------------------------------------------
// Connect wallet (connect dialog + headless web3 provider)
// ---------------------------------------------------------------------------

/**
 * Auto-authorize message-signing and chain-switching. NOT `eth_sendTransaction`
 * — the specs authorize those explicitly via `authorizeTransaction`, and
 * auto-permitting would break that handshake.
 *
 * `SwitchEthereumChain` is required: the Rhinestone SDK calls
 * `walletClient.switchChain()` inside `signWithOwners` before each
 * `eth_signTypedData_v4` call. Without it the authorize middleware queues the
 * request and the signing loop hangs indefinitely.
 */
export const PERMITTED_SIGN_KINDS = [
  Web3RequestKind.SignMessage,
  Web3RequestKind.SignTypedData,
  Web3RequestKind.SignTypedDataV1,
  Web3RequestKind.SignTypedDataV3,
  Web3RequestKind.SignTypedDataV4,
  Web3RequestKind.SwitchEthereumChain,
] as const

/**
 * Select "Headless Web3 Provider" in an already-open connect dialog and
 * authorize the queued permission + account requests.
 *
 * Use this when a connect modal has already been opened (e.g. the pricing
 * page's "Connect or sign in to register" button). For the nav-bar connect
 * flow, use {@link connectWithHeadlessWallet} which opens the modal first.
 */
export async function authorizeHeadlessConnection(
  page: Page,
  wallet: Web3ProviderBackend,
): Promise<void> {
  const headlessOption = page.getByText('Headless Web3 Provider')
  await headlessOption.waitFor({ state: 'visible', timeout: 10_000 })
  await headlessOption.click()

  // The dialog asks the provider to confirm — authorize programmatically.
  // The headless provider queues RequestPermissions then RequestAccounts.
  await expect
    .poll(
      () => wallet.getPendingRequestCount(Web3RequestKind.RequestPermissions),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1)
  await wallet.authorize(Web3RequestKind.RequestPermissions)

  await expect
    .poll(
      () => wallet.getPendingRequestCount(Web3RequestKind.RequestAccounts),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThanOrEqual(1)
  await wallet.authorize(Web3RequestKind.RequestAccounts)
}

/**
 * Connect the headless web3 wallet through the manager's connect dialog.
 *
 * Flow:
 *  1. Click the "Connect" button in the nav bar
 *  2. Select "Headless Web3 Provider" from the wallet list
 *  3. Authorize the wallet_requestPermissions + eth_requestAccounts calls
 *
 * After this resolves the wallet is connected and the nav "Connect" button
 * is gone. The smart-account machine then initialises asynchronously — the
 * EnableSessions / BackendAuth modals are handled by the fixture.
 */
export async function connectWithHeadlessWallet(
  page: Page,
  wallet: Web3ProviderBackend,
): Promise<void> {
  // The desktop nav button renders "Connect" plus an MSymbol "login" icon
  // whose ligature text folds into the accessible name ("Connect login");
  // the mobile button is just "Connect". Match either, anchored so it never
  // catches "Disconnect" / "Connect to register" / "Connect Wallet".
  const connectButton = page.getByRole('button', {
    name: /^connect( login)?$/i,
  })
  await connectButton.waitFor({ state: 'visible', timeout: 15_000 })

  // The manager is an SSR app: the server-rendered Connect button can be
  // clickable before the wallet layer hydrates `openConnectModal`, so the
  // first click is sometimes a no-op and the modal never opens. Retry
  // opening until the connect dialog (with the injected-provider entry)
  // appears — this also absorbs any EIP-6963 discovery delay.
  const modal = page.getByRole('dialog')
  const headlessOption = page.getByText('Headless Web3 Provider')
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await connectButton.click({ timeout: 5_000 }).catch(() => {})
    }
    await expect(headlessOption).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 40_000 })

  await authorizeHeadlessConnection(page, wallet)

  await expect(connectButton).not.toBeVisible({ timeout: 15_000 })
}

/**
 * Click through the "Enable Smart Sessions" modal that appears after the
 * smart account initialises. Idempotent: returns silently if it never shows
 * (sessions already enabled or feature flag off).
 *
 * The modal is a Radix `Dialog`, so its overlay slot is `dialog-overlay` —
 * NOT `alert-dialog-overlay`, which belongs to the BackendAuth dialog. We
 * wait for that exact overlay to disappear so the test doesn't race forward
 * while the session dialog is still closing (and still blocking the page).
 */
export async function clickThroughEnableSessions(page: Page): Promise<void> {
  const enableBtn = page.getByRole('button', { name: /enable sessions/i })
  try {
    await enableBtn.waitFor({ state: 'visible', timeout: 30_000 })
    await enableBtn.click()
    const overlay = page.locator('[data-slot="dialog-overlay"]')
    await overlay.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
  } catch {
    // Modal never appeared — sessions already enabled or feature flag off.
  }
}

// ---------------------------------------------------------------------------
// Backend auth modal (SIWE) — app-level, independent of the connect method
// ---------------------------------------------------------------------------

/**
 * Dismiss the app's BackendAuthModal (SIWE prompt) by clicking
 * "Skip for now" → "Skip Anyway". Idempotent: if the modal doesn't
 * appear within the timeout, returns silently.
 *
 * Why skip rather than complete:
 *   - SIWE requires reaching the backend API worker, which is not part
 *     of the e2e infra stack (we point at the deployed worker, which
 *     introduces external flakiness).
 *   - The modal blocks pointer events on the rest of the page; until
 *     it closes, no test can interact with anything else.
 *   - The modal appears AFTER `smartAccount.isAccountReady`, which on a
 *     fresh fork can take 30-60 s (Rhinestone SCA deploy + HCA
 *     registration + session enable). The helper therefore needs a
 *     generous wait window.
 *
 * Tests that want to exercise the SIWE flow itself should call
 * `signInBackendAuthModal` instead.
 */
export async function dismissBackendAuthModal(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 60_000

  // The verification step's title is "Verify your wallet".
  // The skip-confirmation step's title is "Are you sure?".
  // We key off the "Skip for now" cancel button which is only present
  // in the verification step.
  const skipBtn = page.getByRole('button', { name: 'Skip for now' })

  try {
    await skipBtn.waitFor({ state: 'visible', timeout })
  } catch {
    // Modal never appeared — already skipped/dismissed, EOA-only mode,
    // or feature disabled. Either way, nothing to do.
    console.log(
      '[manager-auth] BackendAuthModal did not appear within timeout — skipping',
    )
    return
  }

  console.log(
    '[manager-auth] BackendAuthModal visible — clicking "Skip for now"',
  )
  await skipBtn.click()

  // The skip-confirmation step replaces the modal contents but keeps
  // the dialog open. Click "Skip Anyway" to fully dismiss.
  const skipAnywayBtn = page.getByRole('button', { name: 'Skip Anyway' })
  await skipAnywayBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await skipAnywayBtn.click()

  // Wait for the dialog overlay to disappear so subsequent navigations
  // are clean and pointer-events on the page are restored.
  const overlay = page.locator('[data-slot="alert-dialog-overlay"]')
  await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
    // Best-effort: if the overlay lingers, downstream interactions
    // will hit retry logic via Playwright's auto-waiting anyway.
  })

  console.log('[manager-auth] BackendAuthModal dismissed')
}

/**
 * Complete the app's BackendAuthModal (SIWE prompt) by signing the
 * message with the connected wallet. Use this only when the test
 * specifically exercises the SIWE / backend-auth flow.
 *
 * Returns silently if the modal does not appear within `timeout`.
 */
export async function signInBackendAuthModal(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 60_000

  // The button stays disabled until the wagmi walletClient is ready,
  // so we explicitly wait for the enabled state rather than just
  // visible.
  const signInBtn = page.getByRole('button', { name: 'Sign in with Wallet' })

  try {
    await signInBtn.waitFor({ state: 'visible', timeout })
  } catch {
    console.log(
      '[manager-auth] BackendAuthModal did not appear within timeout — skipping SIWE',
    )
    return
  }

  // Wait for the button to become enabled (walletClient resolved).
  await signInBtn.waitFor({ state: 'attached', timeout: 10_000 })
  for (let i = 0; i < 30; i += 1) {
    if (await signInBtn.isEnabled()) break
    await page.waitForTimeout(500)
  }

  console.log(
    '[manager-auth] BackendAuthModal visible — clicking "Sign in with Wallet"',
  )
  await signInBtn.click()

  // The modal closes once `backendAuthStore.authKey` is populated.
  await signInBtn.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {
    console.warn(
      '[manager-auth] BackendAuthModal did not close after Sign in — backend may be unreachable',
    )
  })

  const overlay = page.locator('[data-slot="alert-dialog-overlay"]')
  await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------
// These live here rather than re-exporting from portal-auth because the
// manager uses Rhinestone (intent-based signing) while the portal is pure
// EOA.  In the Rhinestone flow only the USDC approval is a plain
// eth_sendTransaction; resolver/commit/register are eth_signTypedData_v4
// intents that are auto-authorized via PERMITTED_SIGN_KINDS.  Owning these
// helpers directly lets us add Rhinestone-specific overloads without
// touching portal infrastructure.

/**
 * Authorize a pending `eth_sendTransaction` in the headless wallet.
 *
 * In the Rhinestone registration flow this is only called once — for the
 * ERC-20 USDC approval.  Intents (resolver deploy, commit, register) are
 * `eth_signTypedData_v4` and are auto-authorized via `PERMITTED_SIGN_KINDS`.
 */
export async function authorizeTransaction(
  wallet: Web3ProviderBackend,
  timeoutMs = 60_000,
): Promise<void> {
  const result = await Promise.race([
    wallet.authorize(Web3RequestKind.SendTransaction),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeoutMs),
    ),
  ])

  if (result === 'timeout') {
    throw new Error(
      `authorizeTransaction timed out after ${timeoutMs}ms waiting for SendTransaction`,
    )
  }
}

/**
 * Wait for and authorize multiple sequential `eth_sendTransaction` requests.
 */
export async function authorizeTransactions(
  wallet: Web3ProviderBackend,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await authorizeTransaction(wallet)
  }
}

/**
 * Authorize any `eth_sendTransaction` requests that arrive while a flow is
 * still running, stopping once `isDone()` reports completion.
 *
 * The post-registration primary-name setup sends two sequential owner-EOA
 * transactions (forward then reverse) when the connected wallet is eligible —
 * and none when it isn't (e.g. it already has a primary name). Polling the
 * pending queue handles both cases and never leaves a dangling `authorize`
 * that could swallow the next test's transaction (single worker).
 */
export async function authorizeTransactionsWhile(
  page: Page,
  wallet: Web3ProviderBackend,
  isDone: () => boolean,
  pollMs = 250,
): Promise<void> {
  while (!isDone()) {
    if (wallet.getPendingRequestCount(Web3RequestKind.SendTransaction) >= 1) {
      await wallet.authorize(Web3RequestKind.SendTransaction)
      continue
    }
    try {
      await page.waitForTimeout(pollMs)
    } catch {
      // Page/context torn down — stop polling rather than throw.
      return
    }
  }
}

/**
 * Authorize the USDC approve `eth_sendTransaction` only if the flow actually
 * requests one, stopping as soon as `isDone()` reports the flow has finished.
 *
 * When the payment-token allowance is already sufficient no approve tx is sent,
 * so a plain `wallet.authorize(SendTransaction)` would block until a fixed
 * timeout — the cause of multi-minute tails in the renew tests. This polls the
 * pending-request queue instead, and never leaves a dangling `authorize` that
 * could swallow the next test's transaction (specs run with a single worker).
 */
export async function authorizeApproveIfRequested(
  page: Page,
  wallet: Web3ProviderBackend,
  isDone: () => boolean,
  pollMs = 250,
): Promise<void> {
  while (!isDone()) {
    if (wallet.getPendingRequestCount(Web3RequestKind.SendTransaction) >= 1) {
      await wallet.authorize(Web3RequestKind.SendTransaction)
      return
    }
    try {
      await page.waitForTimeout(pollMs)
    } catch {
      // Page/context torn down (e.g. the renewal step failed and the test is
      // tearing down) — stop polling rather than throw an unhandled rejection.
      return
    }
  }
}

// ---------------------------------------------------------------------------
// personal_sign raw-hash workaround
// ---------------------------------------------------------------------------

/**
 * Work around a bug in @ensdomains/headless-web3-provider's SignMessageMiddleware:
 * it unconditionally runs `hexToString(req.params[0])` before signing `personal_sign`
 * requests, assuming the payload is always UTF-8 text. The manager app signs raw
 * 32-byte hashes via `walletClient.signMessage({ message: { raw } })` for the
 * primary-name authorization (setPrimaryName.ts's requestPrimaryNameSignature), so
 * the library re-interprets those raw bytes as text and signs the WRONG hash. The
 * resulting signature is one `DefaultReverseRegistrar.setNameForAddrWithSignature`
 * correctly rejects on-chain (confirmed via debug_traceTransaction — ecrecover
 * recovers an address unrelated to the signer). A real wallet extension doesn't
 * have this bug, which is why the flow works when driven manually in a real browser.
 *
 * Intercepts `personal_sign` requests whose payload is exactly a 32-byte hash
 * (a strong signal it's meant to be signed as raw bytes rather than decoded as
 * text — genuine human-readable messages, e.g. SIWE sign-in, are never this
 * shape) and signs them correctly ourselves. Everything else still goes through
 * the library's normal (correct, for text messages) handling.
 */
export function fixRawHashPersonalSign(
  wallet: Web3ProviderBackend,
  privateKey: Hash,
): void {
  const signerAccount = privateKeyToAccount(privateKey)
  const originalRequest = wallet.request.bind(wallet)

  wallet.request = (async (req: { method: string; params?: unknown[] }) => {
    const [rawMessage] = req.params ?? []
    if (
      req.method === 'personal_sign' &&
      typeof rawMessage === 'string' &&
      /^0x[0-9a-fA-F]{64}$/.test(rawMessage)
    ) {
      return signerAccount.signMessage({
        message: { raw: rawMessage as Hash },
      })
    }
    return originalRequest(req)
  }) as typeof wallet.request
}
