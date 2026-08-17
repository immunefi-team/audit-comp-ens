import type { TransactionReceipt } from 'viem'
import { transactionManager } from '../providers/transactionManager'

/**
 * Wait for a transaction to complete and return its receipt.
 * Subscribes to the transaction actor and resolves when successful.
 */
export async function waitForTransactionReceiptById(
  txId: string,
): Promise<TransactionReceipt> {
  const txActor = transactionManager.getTransaction(txId)

  if (!txActor) {
    throw new Error(`Transaction ${txId} not found`)
  }

  const snapshot = txActor.getSnapshot()

  // Already complete?
  if (
    (snapshot.matches?.('success' as never) || snapshot.value === 'success') &&
    snapshot.context.receipt
  ) {
    return snapshot.context.receipt
  }

  // Already failed?
  if (typeof snapshot.value === 'object' && 'error' in snapshot.value) {
    throw snapshot.context.error || new Error(`Transaction ${txId} failed`)
  }

  // Subscribe and wait
  return new Promise<TransactionReceipt>((resolve, reject) => {
    const subscription = txActor.subscribe((nextSnapshot) => {
      if (
        (nextSnapshot.matches?.('success' as never) ||
          nextSnapshot.value === 'success') &&
        nextSnapshot.context.receipt
      ) {
        subscription.unsubscribe()
        resolve(nextSnapshot.context.receipt)
        return
      }

      if (
        typeof nextSnapshot.value === 'object' &&
        'error' in nextSnapshot.value
      ) {
        subscription.unsubscribe()
        reject(
          nextSnapshot.context.error ||
            new Error(`Transaction ${txId} failed during execution`),
        )
      }
    })
  })
}
