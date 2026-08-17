import {
  type Web3ProviderBackend,
  Web3RequestKind,
} from '@ensdomains/headless-web3-provider'
import { expect, type Page } from '@playwright/test'
import type { Address, Hash } from 'viem'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type User = 'user' | 'user2' | 'user3' | 'user4'

export interface PortalAccounts {
  getAddress: (user?: User) => Address
  getAllPrivateKeys: () => Hash[]
  getPrivateKey: (user?: User) => Hash
}

// ---------------------------------------------------------------------------
// Connect wallet
// ---------------------------------------------------------------------------

/**
 * Connect the headless web3 wallet through the portal's connect dialog.
 *
 * Flow:
 *  1. Click the "Connect" button in the portal nav bar
 *  2. Select "Headless Web3 Provider" from the wallet list
 *  3. Programmatically authorize the wallet_requestPermissions and eth_requestAccounts calls
 *
 * After this function resolves the wallet is connected and the page shows
 * the connected account in the nav bar.
 */
export async function connectWithHeadlessWallet(
  page: Page,
  wallet: Web3ProviderBackend,
): Promise<void> {
  // 1. Click the portal's Connect button
  const connectButton = page.getByRole('button', {
    name: 'Connect',
    exact: true,
  })
  await connectButton.waitFor({ state: 'visible', timeout: 15_000 })
  await connectButton.click()

  // 2. Select "Headless Web3 Provider" from the connect dialog
  const headlessOption = page.getByText('Headless Web3 Provider')
  await headlessOption.waitFor({ state: 'visible', timeout: 10_000 })
  await headlessOption.click()

  // 3. The dialog asks the extension to confirm — authorize programmatically.
  //    The headless provider queues RequestPermissions then RequestAccounts.
  await expect
    .poll(
      () => wallet.getPendingRequestCount(Web3RequestKind.RequestPermissions),
      {
        timeout: 15_000,
      },
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

  // Wait until the nav shows the connected state (the Connect button disappears)
  await expect(connectButton).not.toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

/**
 * Authorize a pending `eth_sendTransaction` in the headless wallet.
 *
 * `wallet.authorize()` already supports both cases:
 * - if a matching request is pending, it authorizes immediately
 * - if not, it waits for the next matching request
 *
 * We wrap it with a timeout to avoid hanging indefinitely when no request arrives.
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
 * Wait for and authorize multiple sequential transactions.
 * Useful for multi-step flows like commit → register.
 */
export async function authorizeTransactions(
  wallet: Web3ProviderBackend,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await authorizeTransaction(wallet)
  }
}
