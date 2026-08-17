import type { ActiveTransactionState } from '../hooks/useActiveTransactionState'
import type { Transaction } from '../types'

/**
 * Returns the active transaction: the one matching txState when present,
 * otherwise the first transaction in the flow.
 */
export const getActiveTransaction = (
  transactions: readonly Transaction[],
  txState: ActiveTransactionState | undefined,
): Transaction => {
  if (transactions.length === 0) {
    throw new Error('No transactions provided')
  }

  if (txState) {
    const tx = transactions.find((t) => t.id === txState.txId)
    if (tx) return tx
  }

  return transactions[0]
}
