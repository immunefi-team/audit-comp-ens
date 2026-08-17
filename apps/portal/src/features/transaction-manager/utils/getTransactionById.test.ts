import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { getTransactionById } from './getTransactionById'

const createTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'tx-1',
  title: 'Save records',
  transactionName: 'Set resolver records',
  onStart: () => {},
  onDone: () => {},
  ...overrides,
})

describe('getTransactionById', () => {
  it('returns the transaction when id matches', () => {
    const transactions = [
      createTransaction({ id: 'save-records' }),
      createTransaction({ id: 'other-tx' }),
    ]
    const result = getTransactionById(transactions, 'save-records')
    expect(result).toEqual(transactions[0])
    expect(result.id).toBe('save-records')
  })

  it('returns the first matching transaction when duplicates exist', () => {
    const first = createTransaction({ id: 'tx-a', title: 'First' })
    const transactions = [
      first,
      createTransaction({ id: 'tx-a', title: 'Duplicate' }),
    ]
    const result = getTransactionById(transactions, 'tx-a')
    expect(result).toBe(first)
  })

  it('throws when transaction id is not found', () => {
    const transactions = [createTransaction({ id: 'tx-1' })]
    expect(() => getTransactionById(transactions, 'nonexistent')).toThrow(
      'Transaction with id nonexistent not found',
    )
  })

  it('throws when transactions array is empty', () => {
    expect(() => getTransactionById([], 'any-id')).toThrow(
      'Transaction with id any-id not found',
    )
  })
})
