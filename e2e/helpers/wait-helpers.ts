/**
 * Simple wait utility for E2E (e.g. wait for balance to appear, modals to close).
 * Prefer Playwright locator waits and assertions over fixed sleeps where possible.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
