import { transactionManager } from '@ens-apps/transaction-manager'
import { useEffect } from 'react'
import { reportArchivedTransaction } from './report'

/**
 * Subscribes to terminal transactions and reports them to the authenticated
 * user's account in the notification service. Renders nothing.
 */
export const TransactionHistoryReporter = (): null => {
  useEffect(() => {
    const unsubscribe = transactionManager.onTransactionArchived((archived) => {
      void reportArchivedTransaction(archived)
    })

    return unsubscribe
  }, [])

  return null
}
