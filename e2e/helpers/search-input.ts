import type { Locator, Page } from '@playwright/test'

/**
 * Resolves the visible search input regardless of which page the app landed on.
 *
 * After auth the app may redirect to the dashboard (account owns names) or
 * stay on the landing page (fresh fork / no names). Each has a different
 * search input placeholder:
 *   - Landing: ".eth"
 *   - Dashboard: "Search name, address..."
 *
 * Returns whichever locator becomes visible first.
 */
export async function findSearchInput(
  page: Page,
  timeout = 15_000,
): Promise<Locator> {
  const landing = page.getByPlaceholder('.eth').first()
  const dashboard = page.getByPlaceholder('Search name, address...').first()

  return Promise.race([
    landing.waitFor({ state: 'visible', timeout }).then(() => landing),
    dashboard.waitFor({ state: 'visible', timeout }).then(() => dashboard),
  ])
}
