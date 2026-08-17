import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClient = { chain: { id: 11155111 } }
vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok(mockClient),
}))

const mockGetBlock = vi.fn()
vi.mock('viem/actions', () => ({
  getBlock: mockGetBlock,
}))

const { getBlockTimestamps } = await import('./useBlockTimestamps')

describe('getBlockTimestamps', () => {
  beforeEach(() => {
    mockGetBlock.mockClear()
  })

  it('returns a map of block numbers to timestamps', async () => {
    const blocks = [100n, 200n, 300n]
    const mockTimestamps: Record<string, bigint> = {
      '100': 1000000n,
      '200': 2000000n,
      '300': 3000000n,
    }

    mockGetBlock.mockImplementation((_client, { blockNumber }) =>
      Promise.resolve({ timestamp: mockTimestamps[blockNumber.toString()] }),
    )

    const result = await getBlockTimestamps({ blocks })
    const value = result._unsafeUnwrap()

    expect(value).toBeInstanceOf(Map)
    expect(value.size).toBe(3)
    expect(value.get(100n)).toBe(1000000n)
    expect(value.get(200n)).toBe(2000000n)
    expect(value.get(300n)).toBe(3000000n)
  })

  it('deduplicates blocks', async () => {
    const blocks = [100n, 100n, 200n, 200n, 200n]

    mockGetBlock.mockImplementation((_client, { blockNumber }) =>
      Promise.resolve({ timestamp: blockNumber * 10000n }),
    )

    const result = await getBlockTimestamps({ blocks })
    const value = result._unsafeUnwrap()

    expect(value.size).toBe(2)
    expect(mockGetBlock).toHaveBeenCalledTimes(2)
  })
})
