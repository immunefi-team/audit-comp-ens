/**
 * Standalone-HCA registration E2E test (user-paid USDC, no gas sponsorship).
 *
 * With VITE_FF_USE_EOA=false (default) the registration machine routes through
 * the scoped-SmartSession standalone HCA. The flow is:
 *   1. session authorization (eth_signTypedData_v4 — the one multi-chain
 *      authorization signed BEFORE route selection, via the EnableSessions gate)
 *   2. USDC funding permit  (eth_signTypedData_v4 — EIP-2612, wallet → HCA budget)
 *   3. commit leg           (session-signed request: permit + transferFrom +
 *      enableSessionWithRefund + commit; deploys the HCA lazily)
 *   4. [commitment age wait — handled by the app]
 *   5. reveal batch         (session-signed: price re-read + deployProxy? →
 *      approve → register(wallet) → setters → authorizeNameRoles; no user tx)
 *
 * Two signatures, zero wallet transactions. The mockestrator impersonates the
 * HCA on the Anvil fork to fill each intent; it needs ETH in the HCA address to
 * pay impersonated gas (see `e2e/infra/scripts/fund-rhinestone-account.sh`).
 *
 * Prerequisites:
 *   - E2E infra running: `pnpm e2e:infra:up` (Anvil + Mockestrator)
 *   - Anvil snapshot baked with the STANDALONE-HCA deployment (StandaloneHCA
 *     Factory/Impl, HCAOwnerAndSessionValidator, new registrar/registry, Circle
 *     USDC) and `mockestrator/chains.json` USDC/DAI pointed at those addresses.
 *   - Manager app with VITE_FF_USE_EOA=false.
 */
import {
  authorizeTransactionsWhile,
  test,
} from '../../../fixtures/playwright.manager.fixture.js'
import { createConsoleMonitor } from '../../../helpers/console-monitor.js'
import { expectFlowSuccess } from '../../../helpers/flow-completion.js'
import { clickThroughEnableSessions } from '../../../helpers/manager-auth.js'
import { findSearchInput } from '../../../helpers/search-input.js'

const DOMAIN_TO_REGISTER = `rh-e2e-${Date.now().toString(36)}.eth`

test.describe('ENS name registration (Rhinestone HCA)', () => {
  test('registers a name via Rhinestone HCA headless wallet', async ({
    connectedPage: page,
    mockIndexer,
    accounts,
    wallet,
  }) => {
    const nameOnly = DOMAIN_TO_REGISTER.replace(/\.eth$/i, '')
    const searchInput = await findSearchInput(page)
    await searchInput.click()
    await searchInput.fill(nameOnly)
    await page
      .getByText('Available')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByText(DOMAIN_TO_REGISTER).click()

    await page.getByRole('button', { name: /pay with stablecoins/i }).click()
    // Smart-session gate: on the HCA path (VITE_FF_USE_EOA=false) clicking
    // "Pay with stablecoins" opens the EnableSessions modal BEFORE the token
    // picker. Click through it (the single ENABLE intent is auto-authorized via
    // PERMITTED_SIGN_KINDS); idempotent no-op in EOA mode.
    await clickThroughEnableSessions(page)
    await page.getByText('USDC', { exact: true }).click()

    createConsoleMonitor(page, {
      onStateChange: (state, allStates) => {
        console.log(`[Registration] ${state} (seen: ${allStates.join(' → ')})`)
      },
    })

    await page.getByRole('button', { name: /register name/i }).click()

    // RegistrationDetails (including the completion banner) stays hidden while
    // the parallel notification-settings region is waiting for a choice.
    await page.getByRole('button', { name: 'Set up later' }).click()

    const successBanner = page.locator('p.text-ens-peridot-text-dark')

    // The registration itself needs no eth_sendTransaction on the HCA path
    // (payment is an auto-authorized EIP-2612 permit carried into the
    // sponsored register bundle). But when the wallet is still eligible for
    // the auto primary-name setup, the post-registration step sends two
    // owner-EOA transactions (forward + reverse) that must be authorized —
    // and the completion banner is gated on the whole flow finishing.
    let registrationComplete = false
    const authorizeSetupTxs = authorizeTransactionsWhile(
      page,
      wallet,
      () => registrationComplete,
    )
    await expectFlowSuccess(page, {
      success: successBanner.filter({ hasText: 'Registration Complete' }),
      failureTitle: 'Registration Failed',
      timeout: 240_000,
    })
    registrationComplete = true
    await authorizeSetupTxs

    if (mockIndexer.enabled) {
      mockIndexer.addName({
        name: DOMAIN_TO_REGISTER,
        owner: accounts.getAddress('user'),
      })
    }
  })
})
