import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import type { Transaction } from '../types'
import { getStatus } from './getStatus'

/**
 * Whether a step's `waitUntil` countdown should be visible.
 *
 * Only show it when this step is next (all previous steps succeeded) and not
 * yet started. Otherwise a later step can look like it's waiting while an
 * earlier step is still in progress (e.g. Register "Ready in Xs" during Approve).
 */
export const shouldShowWaitCountdown = (
  transaction: Transaction,
  index: number,
  transactions: readonly Transaction[],
  activeTransactionsMap: Map<string, TransactionMachineActor>,
): boolean => {
  if (
    !transaction.waitUntil ||
    transaction.waitUntil <= Date.now() ||
    getStatus(transaction.id, activeTransactionsMap) !== undefined
  ) {
    return false
  }

  return transactions
    .slice(0, index)
    .every((t) => getStatus(t.id, activeTransactionsMap) === 'success')
}
