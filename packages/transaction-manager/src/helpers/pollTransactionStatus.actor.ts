import { errAsync, fromPromise, type ResultAsync } from 'neverthrow'
import { transactionManager } from '../providers/transactionManager'

/**
 * Actor logic that polls a transaction until it succeeds or fails.
 * Returns the transaction hash on success.
 *
 * Use with `fromResultAsync` in machine invoke.
 */
export const pollTransactionStatus = (
  txId: string,
): ResultAsync<string | undefined, Error> => {
  const txActor = transactionManager.getTransaction(txId)

  if (!txActor) {
    return errAsync(new Error(`Transaction ${txId} not found`))
  }

  return fromPromise(
    new Promise<string | undefined>((resolve, reject) => {
      const subscription = txActor.subscribe((snapshot) => {
        if (snapshot.value === 'success') {
          const context = snapshot.context
          const hash: string | undefined =
            context?.hash || context?.receipt?.transactionHash
          subscription.unsubscribe()
          resolve(hash)
        }
        if (
          typeof snapshot.value === 'object' &&
          snapshot.value !== null &&
          'error' in snapshot.value
        ) {
          subscription.unsubscribe()
          reject(snapshot.context.error || new Error('Transaction failed'))
        }
      })
    }),
    (error) => error as Error,
  )
}
