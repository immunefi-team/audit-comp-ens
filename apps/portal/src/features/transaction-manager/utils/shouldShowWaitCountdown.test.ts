import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { shouldShowWaitCountdown } from './shouldShowWaitCountdown'

const createMockActor = (value: string): TransactionMachineActor =>
  ({
    getSnapshot: () => ({
      value,
      context: {},
    }),
  }) as TransactionMachineActor

const tx = (id: string, waitUntil?: number): Transaction => ({
  id,
  title: id,
  transactionName: id,
  onStart: () => {},
  onDone: () => {},
  waitUntil,
})

describe('shouldShowWaitCountdown', () => {
  it('hides countdown on a later step while an earlier step is in progress', () => {
    const transactions = [
      tx('commit'),
      tx('approve'),
      tx('register', Date.now() + 60_000),
    ]
    const map = new Map<string, TransactionMachineActor>([
      ['commit', createMockActor('success')],
      ['approve', createMockActor('pending')],
    ])

    expect(shouldShowWaitCountdown(transactions[2], 2, transactions, map)).toBe(
      false,
    )
  })

  it('shows countdown when prior steps are done and this step is next', () => {
    const waitUntil = Date.now() + 60_000
    const transactions = [tx('commit'), tx('register', waitUntil)]
    const map = new Map<string, TransactionMachineActor>([
      ['commit', createMockActor('success')],
    ])

    expect(shouldShowWaitCountdown(transactions[1], 1, transactions, map)).toBe(
      true,
    )
  })

  it('shows countdown after approve succeeds (approve step present)', () => {
    const waitUntil = Date.now() + 60_000
    const transactions = [
      tx('commit'),
      tx('approve'),
      tx('register', waitUntil),
    ]
    const map = new Map<string, TransactionMachineActor>([
      ['commit', createMockActor('success')],
      ['approve', createMockActor('success')],
    ])

    expect(shouldShowWaitCountdown(transactions[2], 2, transactions, map)).toBe(
      true,
    )
  })
})
