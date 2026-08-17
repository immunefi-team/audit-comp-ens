import { sleep } from '@ens-apps/utils/sleep'

/**
 * Configuration for indexer sync polling.
 */
export type IndexerSyncConfig = {
  /** Delay before first refetch attempt (ms) */
  initialDelay: number
  /** Interval between refetch attempts (ms) */
  retryInterval: number
  /** Maximum number of refetch attempts */
  maxAttempts: number
}

/**
 * Default configuration for indexer sync polling.
 */
export const DEFAULT_INDEXER_SYNC_CONFIG: IndexerSyncConfig = {
  initialDelay: 5000,
  retryInterval: 3000,
  maxAttempts: 5,
}

/**
 * Parameters for pollForIndexerSync function.
 */
export type PollForIndexerSyncParams = {
  /** Function to invalidate queries */
  invalidateQueries: () => Promise<void>
  /** Optional callback for each attempt (for logging) */
  onAttempt?: (attempt: number, maxAttempts: number) => void
  /** Configuration override */
  config?: Partial<IndexerSyncConfig>
}

/**
 * Poll for indexer sync after a blockchain transaction.
 *
 * Handles indexer lag by waiting before the first attempt,
 * then retrying multiple times with intervals between attempts.
 *
 * @example
 * ```ts
 * await pollForIndexerSync({
 *   invalidateQueries: () => queryClient.invalidateQueries({ queryKey }),
 *   onAttempt: (attempt, max) => console.log(`Attempt ${attempt}/${max}`),
 * })
 * ```
 */
export async function pollForIndexerSync(
  params: PollForIndexerSyncParams,
): Promise<void> {
  const { invalidateQueries, onAttempt, config = {} } = params

  const { initialDelay, retryInterval, maxAttempts } = {
    ...DEFAULT_INDEXER_SYNC_CONFIG,
    ...config,
  }

  // Wait for indexer to catch up
  await sleep(initialDelay)

  // Refetch with retries
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttempt?.(attempt, maxAttempts)

    await invalidateQueries()

    // Wait between retries (but not after the last one)
    if (attempt < maxAttempts) {
      await sleep(retryInterval)
    }
  }
}
