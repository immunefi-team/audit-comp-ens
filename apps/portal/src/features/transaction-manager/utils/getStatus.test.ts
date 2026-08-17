import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import { describe, expect, it } from 'vitest'
import { getStatus } from './getStatus'

const createMockActor = (
  value: string,
  error?: Error,
): TransactionMachineActor =>
  ({
    getSnapshot: () => ({
      value,
      context: { error },
    }),
  }) as TransactionMachineActor

describe('getStatus', () => {
  it('returns status from actor when transaction exists in map', () => {
    const map = new Map<string, TransactionMachineActor>([
      ['tx-1', createMockActor('success')],
    ])
    expect(getStatus('tx-1', map)).toBe('success')
  })

  it('returns error when actor has error in context', () => {
    const map = new Map<string, TransactionMachineActor>([
      ['tx-1', createMockActor('submitting', new Error('Failed'))],
    ])
    expect(getStatus('tx-1', map)).toBe('error')
  })

  it('returns undefined when transaction not in map', () => {
    const map = new Map<string, TransactionMachineActor>([
      ['tx-1', createMockActor('success')],
    ])
    expect(getStatus('tx-2', map)).toBeUndefined()
  })

  it('returns undefined when map is undefined', () => {
    expect(getStatus('tx-1', new Map())).toBeUndefined()
  })
})
