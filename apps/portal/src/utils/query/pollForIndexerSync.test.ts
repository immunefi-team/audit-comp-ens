import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_INDEXER_SYNC_CONFIG,
  type IndexerSyncConfig,
  pollForIndexerSync,
} from './pollForIndexerSync'

// Mock the sleep function
vi.mock('@ens-apps/utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}))

import { sleep } from '@ens-apps/utils/sleep'

describe('pollForIndexerSync', () => {
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
  const mockOnAttempt = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DEFAULT_INDEXER_SYNC_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_INDEXER_SYNC_CONFIG).toEqual({
        initialDelay: 5000,
        retryInterval: 3000,
        maxAttempts: 5,
      })
    })
  })

  describe('pollForIndexerSync', () => {
    it('waits for initial delay before first refetch', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
      })

      expect(sleep).toHaveBeenCalledWith(
        DEFAULT_INDEXER_SYNC_CONFIG.initialDelay,
      )
    })

    it('calls invalidateQueries the correct number of times', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
      })

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(
        DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts,
      )
    })

    it('waits between retry attempts', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
      })

      // Should sleep: 1 initial + (maxAttempts - 1) intervals
      const expectedSleepCalls =
        1 + (DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts - 1)
      expect(sleep).toHaveBeenCalledTimes(expectedSleepCalls)

      // Check interval calls (all except first should be retry interval)
      const sleepCalls = vi.mocked(sleep).mock.calls
      expect(sleepCalls[0][0]).toBe(DEFAULT_INDEXER_SYNC_CONFIG.initialDelay)

      for (let i = 1; i < sleepCalls.length; i++) {
        expect(sleepCalls[i][0]).toBe(DEFAULT_INDEXER_SYNC_CONFIG.retryInterval)
      }
    })

    it('does not sleep after the last attempt', async () => {
      const config: IndexerSyncConfig = {
        initialDelay: 100,
        retryInterval: 50,
        maxAttempts: 2,
      }

      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
        config,
      })

      // Should be: initial delay + 1 interval (not 2)
      expect(sleep).toHaveBeenCalledTimes(2)
    })

    it('calls onAttempt callback for each attempt', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
        onAttempt: mockOnAttempt,
      })

      expect(mockOnAttempt).toHaveBeenCalledTimes(
        DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts,
      )
      expect(mockOnAttempt).toHaveBeenNthCalledWith(
        1,
        1,
        DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts,
      )
      expect(mockOnAttempt).toHaveBeenNthCalledWith(
        2,
        2,
        DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts,
      )
      expect(mockOnAttempt).toHaveBeenNthCalledWith(
        3,
        3,
        DEFAULT_INDEXER_SYNC_CONFIG.maxAttempts,
      )
    })

    it('uses custom config when provided', async () => {
      const customConfig: IndexerSyncConfig = {
        initialDelay: 1000,
        retryInterval: 500,
        maxAttempts: 5,
      }

      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
        config: customConfig,
      })

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(5)
      expect(sleep).toHaveBeenNthCalledWith(1, 1000)
    })

    it('allows partial config override', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
        config: { maxAttempts: 2 },
      })

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2)
      // Should still use default initial delay
      expect(sleep).toHaveBeenNthCalledWith(
        1,
        DEFAULT_INDEXER_SYNC_CONFIG.initialDelay,
      )
    })

    it('works with single attempt', async () => {
      await pollForIndexerSync({
        invalidateQueries: mockInvalidateQueries,
        config: { maxAttempts: 1 },
      })

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
      // Only initial delay, no retry interval
      expect(sleep).toHaveBeenCalledTimes(1)
    })

    it('handles invalidateQueries errors', async () => {
      const error = new Error('Query invalidation failed')
      mockInvalidateQueries.mockRejectedValueOnce(error)

      await expect(
        pollForIndexerSync({
          invalidateQueries: mockInvalidateQueries,
        }),
      ).rejects.toThrow('Query invalidation failed')
    })
  })
})
