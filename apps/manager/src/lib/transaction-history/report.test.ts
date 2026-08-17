import type { ArchivedTransaction } from '@ens-apps/transaction-manager'
import { describe, expect, it } from 'vitest'
import { buildTransactionReport } from './report'

const baseArchived: ArchivedTransaction = {
  txId: 'tx-123',
  chainId: 11155111,
  hash: '0xabc',
  status: 'success',
  operation: 'set-resolver',
  name: 'leon.eth',
  timestamp: 1_700_000_000_000,
}

describe('buildTransactionReport', () => {
  it('maps a complete archived transaction to the report body', () => {
    const body = buildTransactionReport({
      ...baseArchived,
      request: {
        type: 'eoa',
        from: '0xfrom',
        to: '0xto',
        value: 42n,
        chainId: 11155111,
      },
    })

    expect(body).toEqual({
      txId: 'tx-123',
      chainId: 11155111,
      hash: '0xabc',
      status: 'success',
      operation: 'set-resolver',
      name: 'leon.eth',
      payload: { to: '0xto', value: '42' },
    })
  })

  it('returns null when there is no chainId (cannot be reported)', () => {
    expect(
      buildTransactionReport({ ...baseArchived, chainId: undefined }),
    ).toBeNull()
  })

  it('narrows an unknown operation to null', () => {
    const body = buildTransactionReport({
      ...baseArchived,
      operation: 'something-unsupported',
    })

    expect(body?.operation).toBeNull()
  })

  it('nulls the hash when absent and the payload when empty', () => {
    const body = buildTransactionReport({
      ...baseArchived,
      hash: undefined,
      operation: undefined,
      request: undefined,
      error: undefined,
    })

    expect(body?.hash).toBeNull()
    expect(body?.payload).toBeNull()
    expect(body?.operation).toBeNull()
  })

  it('captures a zero value (0n is reported, not treated as absent)', () => {
    const body = buildTransactionReport({
      ...baseArchived,
      request: {
        type: 'eoa',
        from: '0xfrom',
        to: '0xto',
        value: 0n,
        chainId: 11155111,
      },
    })

    expect(body?.payload).toEqual({ to: '0xto', value: '0' })
  })

  it('captures the error message in the payload for failed transactions', () => {
    const body = buildTransactionReport({
      ...baseArchived,
      status: 'error',
      error: 'reverted',
      request: undefined,
    })

    expect(body?.status).toBe('error')
    expect(body?.payload).toEqual({ error: 'reverted' })
  })
})
