/**
 * Time fixture for synchronising the Anvil block timestamp with the
 * Playwright browser clock.
 *
 * Ported from ens-app-v3/playwright/fixtures/time.ts.
 *
 * The core idea: when testing features that rely on block.timestamp
 * (expiry, premium decay, etc.) the browser's Date.now() must agree
 * with the chain's notion of "now".  Playwright's `page.clock` API
 * lets us install a fake clock and fast-forward it in lockstep with
 * `testClient.increaseTime()`.
 */
import type { Page } from '@playwright/test'
import { publicClient, testClient } from '../helpers/anvil-client.js'

export type Time = ReturnType<typeof createTime>

type Dependencies = {
  page: Page
}

export const createTime = ({ page }: Dependencies) => {
  let clockInstalled = false
  return {
    /**
     * Install the browser clock at the current anvil block timestamp.
     * @param offset  Extra seconds to add (e.g. 500 to push the browser
     *                slightly ahead so premium-decay calculations match).
     */
    sync: async (offset = 0) => {
      const block = await publicClient.getBlock()
      const blockTime = Number(block.timestamp)
      const time = new Date((blockTime + offset) * 1000)
      console.log(`[time] sync — browser clock set to ${time.toISOString()}`)
      if (clockInstalled) {
        await page.clock.setSystemTime(time)
      } else {
        await page.clock.install({ time })
        clockInstalled = true
      }
    },

    /**
     * Advance both anvil and browser by `seconds`.
     *
     * After this call:
     *   - The next anvil block will have a timestamp ≥ old + seconds.
     *   - The browser's Date.now() will have advanced by the same amount.
     *
     * Uses `page.clock.setSystemTime` instead of `fastForward` because
     * fastForward's tick parameter overflows a 32-bit signed integer at
     * ~24.8 days (2,147,483,647 ms), which breaks grace-period tests.
     */
    increaseTime: async ({ seconds }: { seconds: number }) => {
      await testClient.increaseTime({ seconds })
      await testClient.mine({ blocks: 1 })
      const block = await publicClient.getBlock()
      const newTime = new Date(Number(block.timestamp) * 1000)
      console.log(`[time] increaseTime +${seconds}s → ${newTime.toISOString()}`)
      await page.clock.setSystemTime(newTime)
    },

    /**
     * Set the browser to a *fixed* time matching the current block.
     * Useful when you don't want the clock to advance between assertions.
     */
    syncFixed: async () => {
      const block = await publicClient.getBlock()
      const blockTime = Number(block.timestamp)
      const time = new Date(blockTime * 1000)
      await page.clock.setFixedTime(time)
      console.log(
        `[time] syncFixed — browser clock fixed at ${time.toISOString()}`,
      )
    },

    /**
     * Resume the fake clock so timers tick at real speed.
     * Call this after makeV2Name to unfreeze setTimeout/setInterval
     * before the test body interacts with the app.
     */
    resume: async () => {
      if (clockInstalled) {
        await page.clock.resume()
      }
    },

    /** Log the current anvil block timestamp (debug helper). */
    logBlockTime: async () => {
      const block = await publicClient.getBlock()
      const blockTime = Number(block.timestamp)
      console.log(
        `[time] block time: ${new Date(blockTime * 1000).toISOString()}`,
      )
    },
  }
}
