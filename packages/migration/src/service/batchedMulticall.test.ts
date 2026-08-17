import type { PublicClient } from 'viem'
import { multicall } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, ok, publicClient } from './_fixtures'
import { batchedMulticall } from './batchedMulticall'

vi.mock('viem/actions', () => ({ multicall: vi.fn() }))

const multicallMock = vi.mocked(multicall)

// Intentionally any: minimal shape required by batchedMulticall.
type AnyContract = Parameters<typeof batchedMulticall>[1][number]

const fakeContracts = (n: number): AnyContract[] =>
  Array.from({ length: n }, (_, i) => ({
    address: `0x${String(i).padStart(40, '0')}`,
    abi: [] as never,
    functionName: 'noop',
    args: [i],
  })) as unknown as AnyContract[]

const respondSuccess = (from: number, count: number) => {
  multicallMock.mockResolvedValueOnce(
    Array.from({ length: count }, (_, i) => ok(from + i)),
  )
}

beforeEach(() => {
  multicallMock.mockReset()
})

describe('batchedMulticall', () => {
  it('returns empty without calling multicall when contracts is empty', async () => {
    expect(await batchedMulticall<number>(publicClient, [])).toEqual([])
    expect(multicallMock).not.toHaveBeenCalled()
  })

  it.each([
    [1, 1, [1]],
    [5000, 1, [5000]],
    [5001, 2, [5000, 1]],
    [10001, 3, [5000, 5000, 1]],
  ])('splits %i contracts across %i chunks', async (total, expectedCalls, chunkSizes) => {
    let cursor = 0
    for (const size of chunkSizes) {
      respondSuccess(cursor, size)
      cursor += size
    }
    const result = await batchedMulticall<number>(
      publicClient as PublicClient,
      fakeContracts(total),
    )
    expect(multicallMock).toHaveBeenCalledTimes(expectedCalls)
    expect(result).toHaveLength(total)
    chunkSizes.forEach((size, i) => {
      expect(
        (multicallMock.mock.calls[i]?.[1] as { contracts: unknown[] })
          .contracts,
      ).toHaveLength(size)
    })
  })

  it('preserves cross-chunk result ordering after flattening', async () => {
    respondSuccess(0, 5000)
    multicallMock.mockResolvedValueOnce([ok(5000), ok(5001)])

    const result = await batchedMulticall<number>(
      publicClient,
      fakeContracts(5002),
    )
    expect(
      result.map((r) => (r.status === 'success' ? r.result : null)),
    ).toEqual(Array.from({ length: 5002 }, (_, i) => i))
  })

  it('always invokes multicall with allowFailure: true and batchSize: 0', async () => {
    multicallMock.mockResolvedValueOnce([ok(0)])
    await batchedMulticall<number>(publicClient, fakeContracts(1))
    expect(multicallMock.mock.calls[0]?.[1]).toMatchObject({
      allowFailure: true,
      batchSize: 0,
    })
  })

  it('preserves failure entries in the flattened output', async () => {
    multicallMock.mockResolvedValueOnce([ok(0), fail(), ok(2)])
    const result = await batchedMulticall<number>(
      publicClient,
      fakeContracts(3),
    )
    expect(result.map((r) => r.status)).toEqual([
      'success',
      'failure',
      'success',
    ])
  })

  it('converts a chunk-level rejection into per-item failure entries', async () => {
    multicallMock.mockRejectedValueOnce(new Error('rpc down'))
    const result = await batchedMulticall<number>(
      publicClient,
      fakeContracts(3),
    )
    expect(result).toHaveLength(3)
    for (const entry of result) {
      expect(entry.status).toBe('failure')
      if (entry.status === 'failure') {
        expect(entry.error.message).toBe('rpc down')
      }
    }
  })

  it('preserves peer chunk results when one chunk rejects', async () => {
    multicallMock.mockRejectedValueOnce(new Error('chunk 1 down'))
    multicallMock.mockResolvedValueOnce([ok(5000)])

    const result = await batchedMulticall<number>(
      publicClient,
      fakeContracts(5001),
    )
    expect(result).toHaveLength(5001)
    expect(result.slice(0, 5000).every((r) => r.status === 'failure')).toBe(
      true,
    )
    expect(result[5000]?.status).toBe('success')
  })
})
