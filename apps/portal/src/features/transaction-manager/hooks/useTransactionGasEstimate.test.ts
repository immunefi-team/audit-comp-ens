import type { EOATransactionRequest } from '@ens-apps/transaction-manager'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  type PublicClient,
  TimeoutError,
} from 'viem'
import { describe, expect, it, vi } from 'vitest'
import {
  deriveStatus,
  estimateGasForCall,
  isRevertError,
} from './useTransactionGasEstimate'

// A genuine on-chain revert: the estimate call executes and the EVM reverts.
const revertError = new ExecutionRevertedError({})
// A revert surfaced through an outer viem error (as it arrives from the
// transport) — `isRevertError` must still find it by walking the cause chain.
const wrappedRevertError = new BaseError('Estimate failed', {
  cause: revertError,
})
// A transient transport problem — deterministically NOT a revert.
const transientError = new TimeoutError({ body: {}, url: '' })

describe('isRevertError', () => {
  it('is true for a direct execution-reverted error', () => {
    expect(isRevertError(revertError)).toBe(true)
  })

  it('is true for a contract-function-reverted error', () => {
    const error = new ContractFunctionRevertedError({
      abi: [],
      functionName: 'renew',
    })
    expect(isRevertError(error)).toBe(true)
  })

  it('is true when a revert is wrapped in an outer BaseError', () => {
    expect(isRevertError(wrappedRevertError)).toBe(true)
  })

  it('is false for a transient transport error', () => {
    expect(isRevertError(transientError)).toBe(false)
  })

  it('is false for a plain (non-viem) error', () => {
    expect(isRevertError(new Error('boom'))).toBe(false)
  })

  it('is false for non-error values', () => {
    expect(isRevertError(undefined)).toBe(false)
    expect(isRevertError(null)).toBe(false)
    expect(isRevertError('reverted')).toBe(false)
  })
})

const baseEoa: EOATransactionRequest = {
  type: 'eoa',
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  data: '0xabcdef',
  chainId: 1,
}

const mockClient = (estimateGas: () => Promise<bigint>): PublicClient =>
  ({ estimateGas: vi.fn(estimateGas) }) as unknown as PublicClient

describe('estimateGasForCall', () => {
  it('returns the live estimate when the call has no gas cap', async () => {
    const client = mockClient(() => Promise.resolve(21_000n))
    expect(await estimateGasForCall(client, baseEoa)).toBe(21_000n)
  })

  it('propagates a failure when the call has no gas cap (nothing to fall back to)', async () => {
    const client = mockClient(() => Promise.reject(revertError))
    await expect(estimateGasForCall(client, baseEoa)).rejects.toBe(revertError)
  })

  it('prefers the live estimate over the gas cap when estimation succeeds', async () => {
    const client = mockClient(() => Promise.resolve(21_000n))
    const eoa = { ...baseEoa, gas: 500_000n }
    expect(await estimateGasForCall(client, eoa)).toBe(21_000n)
  })

  it('falls back to the gas cap when a capped call reverts under estimation', async () => {
    const client = mockClient(() => Promise.reject(revertError))
    const eoa = { ...baseEoa, gas: 500_000n }
    // The tx submits fine with this cap, so we must NOT surface "Unavailable".
    expect(await estimateGasForCall(client, eoa)).toBe(500_000n)
  })

  it('finds a wrapped revert and still falls back to the gas cap', async () => {
    const client = mockClient(() => Promise.reject(wrappedRevertError))
    const eoa = { ...baseEoa, gas: 500_000n }
    expect(await estimateGasForCall(client, eoa)).toBe(500_000n)
  })

  it('re-throws a transient error so react-query can retry it', async () => {
    const client = mockClient(() => Promise.reject(transientError))
    const eoa = { ...baseEoa, gas: 500_000n }
    // A transient blip must bubble up (retryable), not silently take the cap.
    await expect(estimateGasForCall(client, eoa)).rejects.toBe(transientError)
  })
})

const gasQuery = (
  overrides: Partial<UseQueryResult<bigint>>,
): UseQueryResult<bigint> =>
  ({
    fetchStatus: 'fetching',
    status: 'pending',
    isError: false,
    error: null,
    ...overrides,
  }) as UseQueryResult<bigint>

describe('deriveStatus', () => {
  it('is idle before the query has started (no call to estimate yet)', () => {
    const query = gasQuery({ fetchStatus: 'idle', status: 'pending' })
    expect(deriveStatus(query, false, false)).toBe('idle')
  })

  it('is error only when the estimate genuinely reverts', () => {
    const query = gasQuery({ isError: true, error: revertError })
    expect(deriveStatus(query, false, false)).toBe('error')
  })

  it('is success once a cost is available', () => {
    expect(deriveStatus(gasQuery({}), false, true)).toBe('success')
  })

  it('falls back to idle on a transient gas-query error (not a revert)', () => {
    const query = gasQuery({ isError: true, error: transientError })
    // A transient failure must never claim the transaction would fail.
    expect(deriveStatus(query, false, false)).toBe('idle')
  })

  it('falls back to idle when the fee lookup fails', () => {
    expect(deriveStatus(gasQuery({}), true, false)).toBe('idle')
  })

  it('is loading while estimation is in flight with no result yet', () => {
    const query = gasQuery({ fetchStatus: 'fetching', status: 'pending' })
    expect(deriveStatus(query, false, false)).toBe('loading')
  })

  it('surfaces a revert even when a stale cost is present', () => {
    const query = gasQuery({ isError: true, error: revertError })
    // A real revert outranks a leftover cost — the honest signal wins.
    expect(deriveStatus(query, false, true)).toBe('error')
  })
})
