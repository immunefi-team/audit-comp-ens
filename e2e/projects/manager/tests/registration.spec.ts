// e2e/projects/manager/tests/registration.spec.ts
import { expect, test } from '../../../fixtures/playwright.manager.fixture.js'
import { expectFlowSuccess } from '../../../helpers/flow-completion.js'
import {
  authorizeHeadlessConnection,
  authorizeTransactionsWhile,
  clickThroughEnableSessions,
  dismissBackendAuthModal,
} from '../../../helpers/manager-auth.js'

const MANAGER_APP_URL = process.env.MANAGER_APP_URL ?? 'http://localhost:3000'
const DISCONNECTED_DOMAIN = `e2e-${(Date.now() + 1).toString(36)}.eth`
const LATE_AUTH_DOMAIN = `e2e-${(Date.now() + 2).toString(36)}.eth`

test.describe('ENS name registration', () => {
  test('user is unable to register a name when disconnected', async ({
    page,
  }) => {
    // Navigate directly to the register page — the search-dropdown click path
    // is tested in the late-auth test below and in registration-rhinestone.spec.ts.
    // This test's actual assertion is that disconnected users see the
    // "Connect to Register" CTA, not that the search interaction works.
    const label = DISCONNECTED_DOMAIN.replace(/\.eth$/i, '')
    await page.goto(`${MANAGER_APP_URL}/register/${label}`)
    await page.waitForURL(/\/register\//, { timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: /connect to register/i }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('registers a name after connecting from the pricing page', async ({
    page,
    wallet,
  }) => {
    // Navigate directly to avoid the fragile landing-page search-dropdown click
    // (getByText(domain) times out because the label and .eth are separate nodes).
    const label = LATE_AUTH_DOMAIN.replace(/\.eth$/i, '')
    await page.goto(`${MANAGER_APP_URL}/register/${label}`)
    await page.waitForURL(/\/register\//, { timeout: 15_000 })
    // Click "Connect to Register" with retry — the button can be a no-op if
    // the wallet layer hasn't hydrated yet, and the modal can close before we
    // interact with it. Same pattern as connectWithHeadlessWallet.
    const connectBtn = page.getByRole('button', {
      name: /connect to register/i,
    })
    const modal = page.getByRole('dialog')
    const headlessOption = page.getByText('Headless Web3 Provider')
    await expect(async () => {
      if (!(await modal.isVisible().catch(() => false))) {
        await connectBtn.click({ timeout: 5_000 }).catch(() => {})
      }
      await expect(headlessOption).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 40_000 })

    await authorizeHeadlessConnection(page, wallet)

    // Dismiss the SIWE modal before continuing to payment.
    await dismissBackendAuthModal(page)

    await page.getByRole('button', { name: /pay with stablecoins/i }).click()
    // On the smart-account / HCA path, "Pay with stablecoins" opens the
    // EnableSessions modal BEFORE the token picker, which blocks the USDC click.
    // Click through it (auto-authorized via PERMITTED_SIGN_KINDS). The helper is
    // idempotent — a no-op in EOA mode where the modal never appears.
    await clickThroughEnableSessions(page)
    await page.getByText('USDC', { exact: true }).click()
    await page.getByRole('button', { name: /register name/i }).click()

    // RegistrationDetails (including the completion banner) stays hidden while
    // the parallel notification-settings region is waiting for a choice.
    await page.getByRole('button', { name: 'Set up later' }).click()

    const successBanner = page.locator('p.text-ens-peridot-text-dark')
    // Authorize the EOA registration transactions (deploy-resolver? → commit →
    // approve USDC → register) as they arrive while waiting for completion.
    // The completion banner is gated on the whole flow finishing, so once it
    // shows, polling stops without a dangling authorize or a fixed-length tail.
    let registrationComplete = false
    const authorizeAll = authorizeTransactionsWhile(
      page,
      wallet,
      () => registrationComplete,
    )
    await expectFlowSuccess(page, {
      success: successBanner.filter({ hasText: 'Registration Complete' }),
      failureTitle: 'Registration Failed',
      timeout: 180_000,
    })
    registrationComplete = true
    await authorizeAll
  })
})
