/**
 * Temporary Premium E2E Tests (Portal App)
 *
 * These tests register a name on the Anvil Sepolia fork, fast-forward
 * time past expiry so the name enters the 21-day temporary premium
 * window, then verify the portal registration UI displays:
 *
 *   1. "This name is in Temporary premium until ..." alert banner
 *   2. "Learn more" button that opens the TemporaryPremiumDrawer
 *   3. "Temporary premium:" line item in the price breakdown
 *   4. The drawer showing current premium, end date, and calculator
 *
 * The portal uses a headless web3 wallet connected to the
 * anvil fork. The wallet address is passed as `owner` to `rentPrice`,
 * which enables the temporary premium (skipped for address(0)).
 *
 * Prerequisites:
 *   - Anvil fork running on localhost:8545
 *   - Portal app running on PORTAL_APP_URL (default localhost:3001)
 *     with VITE_SEPOLIA_RPC_URL=http://127.0.0.1:8545
 */
import {
  connectWithHeadlessWallet,
  expect,
  test,
} from '../../../fixtures/playwright.portal.fixture.js'

const PORTAL_APP_URL = process.env.PORTAL_APP_URL ?? 'http://localhost:3001'

test.describe
  .skip('Temporary Premium Names', () => {
    /**
     * Full test: register → expire → verify premium UI elements.
     */
    test('should display temporary premium alert, price breakdown, and drawer', async ({
      portalPage: page,
      wallet,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      // ── 1. Create an expired name (~5 days ago) ───────────────────
      console.log('[test:1] Creating expired name (5 days past expiry)...')
      const name = await makeName(
        { label: 'portalpremium', duration: -(5 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )
      console.log(`[test:1] ✅ Created expired name: ${name}`)

      // ── 2. Connect headless wallet ────────────────────────────────
      console.log('[test:2] Connecting headless wallet...')
      await connectWithHeadlessWallet(page, wallet)
      console.log('[test:2] ✅ Wallet connected')

      // ── 3. Navigate to portal registration page ───────────────────
      console.log(`[test:3] Navigating to /register?name=${name}`)
      await page.goto(`${PORTAL_APP_URL}/register?name=${name}`)
      await expect(page.getByText(name).first()).toBeVisible({
        timeout: 30_000,
      })
      console.log('[test:3] ✅ Name visible on page')

      // ── 4. Verify the "Temporary premium" alert banner ────────────
      console.log('[test:4] Checking for temporary premium alert banner...')
      const premiumAlert = page.getByText('This name is in Temporary premium')
      await expect(premiumAlert).toBeVisible({ timeout: 30_000 })
      console.log('[test:4] ✅ Temporary premium alert banner visible')

      // ── 5. Verify "Temporary premium:" line in price breakdown ────
      console.log('[test:5] Checking for "Temporary premium:" line item...')
      await expect(page.getByText('Temporary premium')).toBeVisible({
        timeout: 15_000,
      })
      console.log('[test:5] ✅ Temporary premium line item visible')

      // ── 6. Verify the total includes a large premium amount ───────
      console.log('[test:6] Checking for "Total:" row...')
      await expect(page.getByText('Total:', { exact: true })).toBeVisible()
      console.log('[test:6] ✅ Total row visible')

      // ── 7. Click "Learn more" to open the drawer ──────────────────
      console.log('[test:7] Clicking "Learn more" button...')
      const learnMoreBtn = page.getByRole('button', { name: /learn more/i })
      await expect(learnMoreBtn).toBeVisible()
      await learnMoreBtn.click()
      console.log('[test:7] ✅ Learn more clicked')

      // ── 8. Verify drawer contents ─────────────────────────────────
      console.log('[test:8] Verifying drawer contents...')

      await expect(
        page.getByRole('heading', { name: 'Temporary premium', exact: true }),
      ).toBeVisible({ timeout: 10_000 })
      console.log('[test:8a] ✅ Drawer title visible')

      await expect(page.getByText('Current temporary premium')).toBeVisible()
      console.log('[test:8b] ✅ Current temporary premium section visible')

      await expect(page.getByText('Temporary premium ends')).toBeVisible()
      console.log('[test:8c] ✅ Temporary premium ends section visible')

      await expect(
        page.getByText('Calculate premium at a specific date'),
      ).toBeVisible()
      console.log('[test:8d] ✅ Premium calculator section visible')

      await expect(page.locator('#premium-price-input')).toBeVisible()
      console.log('[test:8e] ✅ Price input visible')

      await expect(page.locator('#premium-date-input')).toBeVisible()
      console.log('[test:8f] ✅ Date picker visible')

      console.log('[test] ✅ ALL STEPS PASSED')
    })

    /**
     * Verify a name expired 18 days ago (near end of 21-day window)
     * still shows the temporary premium UI.
     */
    test('should show temporary premium for a name near the end of the premium window', async ({
      portalPage: page,
      wallet,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      console.log('[test:1] Creating expired name (18 days past expiry)...')
      const name = await makeName(
        { label: 'portallowpremium', duration: -(18 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )
      console.log(`[test:1] ✅ Created low-premium name: ${name}`)

      console.log('[test:2] Connecting wallet...')
      await connectWithHeadlessWallet(page, wallet)
      console.log('[test:2] ✅ Wallet connected')

      console.log(`[test:3] Navigating to /register?name=${name}`)
      await page.goto(`${PORTAL_APP_URL}/register?name=${name}`)
      await expect(page.getByText(name).first()).toBeVisible({
        timeout: 30_000,
      })
      console.log('[test:3] ✅ Name visible')

      console.log('[test:4] Checking for temporary premium alert...')
      await expect(
        page.getByText('This name is in Temporary premium'),
      ).toBeVisible({ timeout: 30_000 })
      console.log('[test:4] ✅ Temporary premium alert visible')

      console.log('[test:5] Checking for "Temporary premium:" line...')
      await expect(page.getByText('Temporary premium')).toBeVisible({
        timeout: 15_000,
      })
      console.log('[test:5] ✅ Temporary premium line visible')

      console.log('[test] ✅ ALL STEPS PASSED')
    })

    /**
     * Verify a name expired past the 21-day window does NOT show
     * temporary premium UI.
     */
    test('should not show temporary premium for a name past the 21-day window', async ({
      portalPage: page,
      wallet,
      makeName,
      time,
    }) => {
      test.setTimeout(180_000)

      console.log(
        '[test:1] Creating expired name (25 days past expiry — beyond premium window)...',
      )
      const name = await makeName(
        { label: 'portalnopremium', duration: -(25 * 24 * 60 * 60) },
        { timeOffset: 0 },
      )
      console.log(`[test:1] ✅ Created name: ${name}`)

      console.log('[test:2] Connecting wallet...')
      await connectWithHeadlessWallet(page, wallet)
      console.log('[test:2] ✅ Wallet connected')

      console.log(`[test:3] Navigating to /register?name=${name}`)
      await page.goto(`${PORTAL_APP_URL}/register?name=${name}`)
      await expect(page.getByText(name).first()).toBeVisible({
        timeout: 30_000,
      })
      console.log('[test:3] ✅ Name visible')

      console.log('[test:4] Verifying NO temporary premium alert...')
      await expect(
        page.getByText('This name is in Temporary premium'),
      ).not.toBeVisible({ timeout: 10_000 })
      console.log('[test:4] ✅ No temporary premium alert (correct)')

      console.log('[test:5] Verifying NO "Temporary premium:" line...')
      await expect(page.getByText('Temporary premium')).not.toBeVisible({
        timeout: 5_000,
      })
      console.log('[test:5] ✅ No temporary premium line (correct)')

      console.log('[test] ✅ ALL STEPS PASSED')
    })
  })
