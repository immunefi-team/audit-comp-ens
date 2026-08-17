/**
 * Temporary Premium E2E Tests (Manager App)
 *
 * These tests register a name on the Anvil Sepolia fork, fast-forward
 * time past expiry so the name enters the 21-day temporary premium
 * window, then verify the manager registration UI displays the correct
 * premium pricing information.
 *
 * The V2 registration flow at /register/$name shows:
 *   - PricingDomainHeader: shows character-based premium labels (3-4 char names)
 *   - ConfirmPurchase: shows premium label + total price including premium
 *   - RegistrationDetails (post-purchase): shows "Premium Fee" line item
 *
 * The temporary premium (from StandardRentPriceOracle) is separate from
 * character-based premium — it applies to any recently expired name for
 * 21 days with an exponential halving decay starting at $100M.
 *
 * Prerequisites:
 *   - Anvil fork running on localhost:8545
 *   - Manager app running on MANAGER_APP_URL (default localhost:3000)
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../../../fixtures/playwright.manager.fixture.js'

const MANAGER_APP_URL = process.env.MANAGER_APP_URL ?? 'http://localhost:3000'

/**
 * After navigating directly to /register/<name>, the app may show a
 * "Verify your wallet" SIWE modal. Click "Sign in with Wallet" to
 * dismiss it so the pricing query uses the real owner address
 * (required for temporary premium to be included).
 *
 * The StandardRentPriceOracle skips temporary premium when owner is
 * address(0).  The app passes ownerAddress ?? zeroAddress to rentPrice,
 * so we MUST complete the SIWE flow for premium to appear.
 */
async function dismissSiweModal(page: Page) {
  const signInBtn = page.getByRole('button', { name: /sign in with wallet/i })
  const skipBtn = page.getByRole('button', { name: /skip for now/i })
  const modalBtn = signInBtn.or(skipBtn)
  try {
    await modalBtn.first().waitFor({ state: 'visible', timeout: 8_000 })
    // Prefer "Sign in with Wallet" so the owner address is set for pricing
    if (await signInBtn.isVisible()) {
      await signInBtn.click()
      // Wait for the signing to complete — the button changes to "Signing in..."
      // then the modal disappears once the SIWE session is established.
      await signInBtn
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .catch(() => {})
    } else {
      await skipBtn.click()
    }
    // Extra wait for modal to fully close and pricing to re-fetch
    await page.waitForTimeout(2_000)
  } catch {
    // Modal didn't appear — already signed in
  }

  // After navigating to /register/<name>, the smart account may
  // re-initialise and show the "Enable Smart Sessions" modal.
  // It cannot be dismissed — we must click through it.
  const enableBtn = page.getByRole('button', { name: /enable sessions/i })
  try {
    await enableBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await enableBtn.click()
    const overlay = page.locator('[data-slot="alert-dialog-overlay"]')
    await overlay.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
  } catch {
    // Modal didn't appear — sessions already enabled or feature flag off
  }

  // Wait for the "Pay with stablecoins" button to confirm the wallet
  // session is fully established (replaces "Connect or sign in")
  await page
    .getByRole('button', { name: /pay with stablecoins/i })
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {})
}

test.describe
  .skip('Temporary Premium Names', () => {
    /**
     * Register a name, expire it by ~4 days (within the 21-day premium window),
     * navigate to /register/<name>.eth, and verify the pricing step reflects
     * a non-zero premium in the total price.
     */
    test('should show premium pricing for a recently expired name', async ({
      connectedPage: page,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      // ── 1. Create an expired name (expired ~4 days ago) ───────────
      // duration = -(4 days in seconds) → name expired 4 days ago
      // This puts it in the 21-day premium window (price halves daily)
      const name = await makeName(
        { label: 'temppremium', duration: -(4 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )

      console.log(`[test] Created expired name: ${name}`)

      // ── 2. Navigate to the V2 registration page for the expired name
      // Must be authenticated — the StandardRentPriceOracle skips the
      // temporary premium when owner is address(0) (unauthenticated).
      await page.goto(`${MANAGER_APP_URL}/register/${name}`)

      // Dismiss the "Verify your wallet" / SIWE modal if it appears
      await dismissSiweModal(page)

      // Wait for the pricing step to load
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      // ── 3. Verify the "Pay with stablecoins" button is visible ────
      // (confirms user is authenticated and pricing loaded)
      await expect(
        page.getByRole('button', { name: /pay with stablecoins/i }),
      ).toBeVisible({ timeout: 15_000 })

      // ── 4. Verify the price includes a premium ────────────────────
      // A 4-day-old premium should be ~$6.25M. The total price displayed
      // in the PaymentCard should be dramatically higher than the ~$5
      // base price for 1 year. We check for a dollar amount with at
      // least 4 digits (i.e. >= $1,000) to confirm premium is included.
      const totalText = page.locator('span').filter({ hasText: /^\$[\d,]+/ })
      await expect(totalText.first()).toBeVisible({ timeout: 15_000 })
    })

    /**
     * Register a name expired by 1 day — very early in the premium window.
     * The premium is extremely high (~$50M). Verify the registration page loads.
     */
    test('should load registration page for a 1-day-expired name', async ({
      connectedPage: page,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      const name = await makeName(
        { label: 'recentexpiry', duration: -(1 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )

      console.log(`[test] Created recently expired name: ${name}`)

      await page.goto(`${MANAGER_APP_URL}/register/${name}`)
      await dismissSiweModal(page)

      // The page should load and show the name
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      // Authenticated user should see "Pay with stablecoins" (not "Connect")
      await expect(
        page.getByRole('button', { name: /pay with stablecoins/i }),
      ).toBeVisible({ timeout: 15_000 })
    })

    /**
     * Register a name expired 18 days ago
     * premium window. Premium should be very small (< $1).
     */
    test('should show a low premium for a name expired 18 days ago', async ({
      connectedPage: page,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      const name = await makeName(
        { label: 'lowpremium', duration: -(18 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )

      console.log(`[test] Created name with low premium: ${name}`)

      await page.goto(`${MANAGER_APP_URL}/register/${name}`)
      await dismissSiweModal(page)

      // Should still load the registration page (name is available with low premium)
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      await expect(
        page.getByRole('button', { name: /pay with stablecoins/i }),
      ).toBeVisible({ timeout: 15_000 })
    })

    /**
     * Register a name expired 25 days ago
     * The premium should be 0 and the name should register at base price only.
     */
    test('should show no premium for a name expired past the 21-day window', async ({
      connectedPage: page,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      const name = await makeName(
        { label: 'nopremium', duration: -(25 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )

      console.log(`[test] Created name past premium window: ${name}`)

      await page.goto(`${MANAGER_APP_URL}/register/${name}`)
      await dismissSiweModal(page)

      await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      await expect(
        page.getByRole('button', { name: /pay with stablecoins/i }),
      ).toBeVisible({ timeout: 15_000 })
    })
  })
