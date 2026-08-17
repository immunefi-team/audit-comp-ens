import type { Web3ProviderBackend } from '@ensdomains/headless-web3-provider'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { expectFlowSuccess } from './flow-completion.js'
import {
  authorizeTransaction,
  clickThroughEnableSessions,
} from './manager-auth.js'

const MANAGER_APP_URL = process.env.MANAGER_APP_URL ?? 'http://localhost:3000'

export async function goToProfile(page: Page, name: string) {
  await page.goto(`${MANAGER_APP_URL}/p/${name}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2_000)
}

export async function goToEditProfile(page: Page, name: string) {
  await goToProfile(page, name)
  await page.getByRole('button', { name: 'Edit Profile' }).click()
  await page.waitForTimeout(1_500)
}

/**
 * Clicks a pill button to reveal a profile field if it isn't already mounted,
 * then asserts the field becomes visible.
 *
 * Useful for Contact-tab methods that have an aria-label matching fieldLabel.
 */
export async function ensureProfilePillField(
  page: Page,
  options: { pillName: RegExp; fieldLabel: string | RegExp },
) {
  const field = page.getByLabel(options.fieldLabel)
  if ((await field.count()) === 0) {
    await page.getByRole('button', { name: options.pillName }).click()
  }
  await expect(field).toBeVisible({ timeout: 10_000 })
}

/**
 * Clicks the "Save Profile" button in the edit-profile dialog header.
 * The dialog closes automatically once the on-chain save succeeds.
 *
 * In-place record writes always go out as a plain `eth_sendTransaction` from
 * the owner EOA (see EditProfileDialog.machine.ts's `getPendingSave`), even in
 * Rhinestone HCA mode — unlike the sign-typed-data intents that
 * PERMITTED_SIGN_KINDS auto-authorizes. Authorize it here or the dialog spins
 * on "Saving" until `waitForProfileUpdated` times out.
 */
export async function saveProfileChanges(
  page: Page,
  wallet: Web3ProviderBackend,
) {
  await Promise.all([
    page.getByRole('button', { name: 'Save Profile' }).click(),
    authorizeTransaction(wallet, 30_000),
  ])
}

export async function waitForProfileUpdated(page: Page, timeout = 90_000) {
  // The edit-profile dialog closes automatically when the save succeeds.
  await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout })
}

/**
 * On the renew page, selects the minimum 28-day duration via the custom date
 * picker, completes the USDC payment flow, and asserts the success screen shows
 * the correct expiry date. Returns the formatted expiry string (e.g. "June 29, 2026").
 */
export async function renewFor28Days(page: Page): Promise<string> {
  await page.getByRole('button', { name: /renew to date/i }).click()
  await page.getByRole('button', { name: 'Minimum' }).click()
  await page.locator('body').click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(500)

  // "expiring on" and the date are rendered as separate sibling elements
  // (spaced via CSS gap, not a text node), so read the date from the label's
  // next sibling rather than relying on a space in the concatenated text.
  const expiringOnValue = page
    .getByText('expiring on', { exact: true })
    .locator('xpath=following-sibling::*[1]')
  const expiringOnText = await expiringOnValue.textContent()
  const dateMatch = expiringOnText?.match(
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/,
  )
  if (!dateMatch)
    throw new Error('Could not read expected expiry date from pricing summary')
  const expectedExpiry = dateMatch[0]

  await page.getByRole('button', { name: /pay with stablecoins/i }).click()
  // Smart-session gate: on the HCA path clicking "Pay with stablecoins" opens the
  // EnableSessions modal BEFORE the token picker — same gate as registration.
  // Idempotent no-op in EOA mode or when sessions are already active.
  await clickThroughEnableSessions(page)
  await page.getByText('USDC', { exact: true }).click()
  await page.getByRole('button', { name: /renew name/i }).click()
  await page.getByRole('button', { name: /renew name/i }).click()

  await expectFlowSuccess(page, {
    success: page.getByText('Renewal Complete!'),
    failureTitle: 'Renewal Failed',
    timeout: 90_000,
  })
  await expect(page.getByText(expectedExpiry)).toBeVisible({ timeout: 5_000 })

  return expectedExpiry
}
