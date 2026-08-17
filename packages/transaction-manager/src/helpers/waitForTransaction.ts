import type { Hash, TransactionReceipt } from 'viem'
import { transactionManager } from '../providers/transactionManager'

/**
 * Result returned when a transaction completes successfully
 */
export interface WaitForTransactionResult {
  hash: Hash
  receipt?: TransactionReceipt
}

/**
 * Wait only until a transaction has been submitted and has a hash. This lets
 * callers persist retry metadata before receipt polling completes.
 */
export async function waitForTransactionHash(txId: string): Promise<Hash> {
  const txActor = transactionManager.getTransaction(txId)

  if (!txActor) {
    throw new Error(`Transaction ${txId} not found`)
  }

  const snapshot = txActor.getSnapshot()
  if (snapshot.context.hash) return snapshot.context.hash
  if (typeof snapshot.value === 'object' && 'error' in snapshot.value) {
    throw snapshot.context.error || new Error(`Transaction ${txId} failed`)
  }

  return new Promise<Hash>((resolve, reject) => {
    const subscription = txActor.subscribe((nextSnapshot) => {
      if (nextSnapshot.context.hash) {
        subscription.unsubscribe()
        resolve(nextSnapshot.context.hash)
        return
      }

      if (
        typeof nextSnapshot.value === 'object' &&
        'error' in nextSnapshot.value
      ) {
        subscription.unsubscribe()
        reject(
          nextSnapshot.context.error ||
            new Error(`Transaction ${txId} failed during submission`),
        )
      }
    })
  })
}

/**
 * Wait for a transaction to complete and return its result.
 *
 * This is a Promise wrapper that subscribes to a transaction actor
 * and resolves on success or rejects on error. Generic helper that
 * works with any transaction managed by transactionManager.
 *
 * @param txId - The transaction ID returned from transactionManager.startTransaction()
 * @returns Promise that resolves with hash and receipt on success
 * @throws Error if transaction not found or fails
 *
 * @example
 * ```ts
 * const txId = transactionManager.startTransaction(intent, signer, options)
 * const { hash, receipt } = await waitForTransaction(txId)
 * ```
 */
export async function waitForTransaction(
  txId: string,
): Promise<WaitForTransactionResult> {
  const txActor = transactionManager.getTransaction(txId)

  if (!txActor) {
    throw new Error(`Transaction ${txId} not found`)
  }

  const snapshot = txActor.getSnapshot()
  const completedHash =
    snapshot.context.receipt?.transactionHash ?? snapshot.context.hash

  // Already complete?
  if (
    (snapshot.matches?.('success' as never) || snapshot.value === 'success') &&
    completedHash
  ) {
    return {
      hash: completedHash,
      receipt: snapshot.context.receipt,
    }
  }

  // Already failed?
  if (typeof snapshot.value === 'object' && 'error' in snapshot.value) {
    throw snapshot.context.error || new Error(`Transaction ${txId} failed`)
  }

  // Subscribe and wait
  return new Promise<WaitForTransactionResult>((resolve, reject) => {
    const subscription = txActor.subscribe((nextSnapshot) => {
      const completedHash =
        nextSnapshot.context.receipt?.transactionHash ??
        nextSnapshot.context.hash
      if (
        (nextSnapshot.matches?.('success' as never) ||
          nextSnapshot.value === 'success') &&
        completedHash
      ) {
        subscription.unsubscribe()
        resolve({
          hash: completedHash,
          receipt: nextSnapshot.context.receipt,
        })
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
