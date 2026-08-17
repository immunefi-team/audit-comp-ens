import { describe, expect, it } from 'vitest'
import type { ActiveTransactionState } from '../hooks/useActiveTransactionState'
import type { Transaction } from '../types'
import { getActiveTransaction } from './getActiveTransaction'

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

const createTxState = (
  overrides: Partial<ActiveTransactionState> = {},
): ActiveTransactionState => ({
  txId: 'tx-1',
  machineState: 'submitting',
  hash: undefined,
  error: undefined,
  ...overrides,
})

describe('getActiveTransaction', () => {
  it('returns transaction matching txState when txState is present', () => {
    const deployTx = createTransaction({ id: 'deploy' })
    const changeTx = createTransaction({ id: 'change' })
    const transactions = [deployTx, changeTx]
    const txState = createTxState({ txId: 'change' })
    expect(getActiveTransaction(transactions, txState)).toBe(changeTx)
  })

  it('returns first transaction when txState is undefined', () => {
    const deployTx = createTransaction({ id: 'deploy' })
    const changeTx = createTransaction({ id: 'change' })
    const transactions = [deployTx, changeTx]
    expect(getActiveTransaction(transactions, undefined)).toBe(deployTx)
  })

  it('throws when txState is undefined and transactions is empty', () => {
    expect(() => getActiveTransaction([], undefined)).toThrow(
      'No transactions provided',
    )
  })

  it('returns first transaction when txState references an unknown id (stale state)', () => {
    const deployTx = createTransaction({ id: 'deploy' })
    const changeTx = createTransaction({ id: 'change' })
    const transactions = [deployTx, changeTx]
    const txState = createTxState({ txId: 'tx-reg-register' })
    expect(getActiveTransaction(transactions, txState)).toBe(deployTx)
  })
})
