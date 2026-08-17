/**
 * Promise-based sleep utility.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```ts
 * await sleep(1000) // Wait 1 second
 * ```
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
