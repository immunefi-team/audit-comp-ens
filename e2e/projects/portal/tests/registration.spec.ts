import {
  connectWithHeadlessWallet,
  expect,
  test,
} from '../../../fixtures/playwright.portal.fixture.js'
import { createConsoleMonitor } from '../../../helpers/console-monitor.js'
import { authorizeTransaction } from '../../../helpers/portal-auth.js'

const PORTAL_APP_URL = process.env.PORTAL_APP_URL ?? 'http://localhost:3001'
const DOMAIN_TO_REGISTER =
  process.env.E2E_DOMAIN ?? `e2e-portal-${Date.now().toString(36)}.eth`

test.describe('Portal ENS name registration', () => {
  test('registers a name via headless wallet and stablecoin payment', async ({
    portalPage: page,
    wallet,
  }) => {
    test.setTimeout(300_000) // Registration involves multiple on-chain txs

    // ── 1. Connect wallet ──────────────────────────────────────────
    await connectWithHeadlessWallet(page, wallet)

    // ── 2. Navigate to registration page ───────────────────────────
    await page.goto(`${PORTAL_APP_URL}/register?name=${DOMAIN_TO_REGISTER}`)

    // Wait for the registration form to load with the name visible
    await expect(page.getByText(DOMAIN_TO_REGISTER).first()).toBeVisible({
      timeout: 30_000,
    })

    // ── 3. Select USDC in the payment section ───────────────────────
    const paymentSection = page.locator(
      'section:has-text("Select payment method")',
    )

    await expect(paymentSection).toBeVisible({ timeout: 10_000 })

    const usdcOption = paymentSection
      .getByRole('button', { name: 'USDC' })
      .first()
    await usdcOption.waitFor({ state: 'visible', timeout: 10_000 })
    await usdcOption.click()

    const registerButton = paymentSection.getByRole('button', {
      name: /^Register$/i,
    })
    await registerButton.waitFor({ state: 'visible', timeout: 10_000 })
    await registerButton.click()

    // ── 5. Review transaction steps and start registration ───────
    const transactionDialog = page.locator('[data-slot="dialog-content"]')

    await expect(transactionDialog).toBeVisible({ timeout: 30_000 })

    const monitor = createConsoleMonitor(page, {
      onStateChange: (state, allStates) => {
        console.log(
          `[Portal Registration] ${state} (seen: ${allStates.join(' → ')})`,
        )
      },
    })

    let registerTxSucceeded = false
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('Transaction tx-reg-register state: success')) {
        registerTxSucceeded = true
      }
    })

    const startButton = transactionDialog.getByRole('button', {
      name: /^Start$/i,
    })
    await startButton.waitFor({ state: 'visible', timeout: 30_000 })
    await startButton.click()

    await expect(transactionDialog.getByText('Transaction flow')).toBeVisible({
      timeout: 30_000,
    })

    const flowDeadline = Date.now() + 420_000
    while (Date.now() < flowDeadline && !registerTxSucceeded) {
      const openWalletButton = transactionDialog.getByRole('button', {
        name: /open wallet/i,
      })
      if (await openWalletButton.isVisible().catch(() => false)) {
        await openWalletButton.click()
        await authorizeTransaction(wallet, 60_000)
        await page.waitForTimeout(500)
        continue
      }

      const waitingButton = transactionDialog.getByRole('button', {
        name: /^Waiting\.\.\.$/i,
      })
      if (await waitingButton.isVisible().catch(() => false)) {
        // Newer UI can render an icon-only wallet action button next to
        // the Waiting button (without an accessible text label).
        const iconWalletButton = waitingButton.locator(
          'xpath=preceding-sibling::button[1]',
        )
        if (await iconWalletButton.isVisible().catch(() => false)) {
          await iconWalletButton.click()
          await authorizeTransaction(wallet, 60_000)
          await page.waitForTimeout(500)
          continue
        }
      }

      const primaryButton = transactionDialog.getByRole('button', {
        name: /^(Start|Next|Done)$/i,
      })
      if (
        (await primaryButton.isVisible().catch(() => false)) &&
        (await primaryButton.isEnabled().catch(() => false))
      ) {
        await primaryButton.click({ timeout: 2_000 }).catch(() => {})
        await page.waitForTimeout(500)
        continue
      }

      await page.waitForTimeout(1_000)
    }

    expect(registerTxSucceeded).toBe(true)

    // ── 7. Assert success ──────────────────────────────────────────
    expect(monitor.getLastState()).toBe('success')

    // Registration redirects to the name overview and shows a success banner
    // (after the indexer-sync poll), so allow extra time for the redirect.
    await expect(page.getByText('Congratulations!')).toBeVisible({
      timeout: 60_000,
    })
    await expect(
      page.getByText(new RegExp(`You are the owner of ${DOMAIN_TO_REGISTER}`)),
    ).toBeVisible({ timeout: 30_000 })
  })
})
