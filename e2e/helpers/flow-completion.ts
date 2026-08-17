import type { Locator, Page } from '@playwright/test'

/**
 * Wait for a flow's success banner, failing as soon as the app renders its
 * failure step instead.
 *
 * The registration and renewal flows both end in either a completion banner or
 * a failure step carrying the underlying error. Waiting only on the banner
 * makes those two outcomes indistinguishable: a reverted transaction burns the
 * whole timeout and reports "element(s) not found", with the actual reason
 * sitting on screen unread.
 */
export async function expectFlowSuccess(
  page: Page,
  {
    success,
    failureTitle,
    timeout,
    pollMs = 500,
  }: {
    success: Locator
    failureTitle: string
    timeout: number
    pollMs?: number
  },
): Promise<void> {
  const failure = page.getByText(failureTitle, { exact: false }).first()
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    if (await success.isVisible().catch(() => false)) return

    if (await failure.isVisible().catch(() => false)) {
      const detail = await failure
        .locator('xpath=following-sibling::*[1]')
        .innerText()
        .catch(() => '')
      throw new Error(
        `flow reported "${failureTitle}": ${detail.trim() || '(no detail rendered)'}`,
      )
    }

    try {
      await page.waitForTimeout(pollMs)
    } catch {
      // Page/context torn down mid-wait, let the caller's teardown handle it.
      return
    }
  }

  throw new Error(
    `timed out after ${timeout}ms waiting for the success banner; no failure step was rendered either, so the flow is still mid-transaction`,
  )
}
