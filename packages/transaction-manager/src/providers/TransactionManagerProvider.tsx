import { logger } from '@ens-apps/utils/logger'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { PublicClient } from 'viem'
import type { ActorRefFrom } from 'xstate'
import {
  getPendingTransactions,
  type PersistedTransaction,
} from '../helpers/transaction-persistence'
import type { transactionMachine } from '../machines/transaction.machine'
import { transactionManager } from './transactionManager'

interface TransactionManagerContextValue {
  transactions: Map<string, ActorRefFrom<typeof transactionMachine>>
}

interface TransactionManagerProviderProps {
  children: ReactNode
  publicClient: PublicClient
}

const TransactionManagerContext =
  createContext<TransactionManagerContextValue | null>(null)

/**
 * Transaction Manager Provider
 *
 * React wrapper for the singleton TransactionManager.
 * Provides React state subscriptions for UI components.
 *
 * Note: startTransaction() should be called directly from the singleton,
 * passing publicClient in options.
 *
 * SSR-safe: No global state stored in the provider.
 */
export const TransactionManagerProvider = ({
  children,
}: TransactionManagerProviderProps) => {
  const [transactions, setTransactions] = useState<
    Map<string, ActorRefFrom<typeof transactionMachine>>
  >(new Map())

  // Subscribe to singleton's transaction changes for React updates
  useEffect(() => {
    const unsubscribe = transactionManager.onTransactionsChange((txMap) => {
      setTransactions(txMap)
    })

    return unsubscribe
  }, [])

  const contextValue: TransactionManagerContextValue = {
    transactions,
  }

  return (
    <TransactionManagerContext.Provider value={contextValue}>
      {children}
    </TransactionManagerContext.Provider>
  )
}

/**
 * Hook to access the transaction manager (for UI components only)
 *
 * Returns the transactions Map for React components to subscribe to updates.
 *
 * NOTE: To start transactions, import and use the singleton directly:
 * ```
 * import { transactionManager } from '@ens-apps/transaction-manager'
 * transactionManager.startTransaction(request, signer, options)
 * ```
 */
export function useTransactionManager(): TransactionManagerContextValue {
  const context = useContext(TransactionManagerContext)
  if (!context) {
    throw new Error(
      'useTransactionManager must be used within TransactionManagerProvider',
    )
  }
  return context
}

/**
 * Hook to get a specific transaction actor by ID
 */
export function useTransaction(
  id: string,
): ActorRefFrom<typeof transactionMachine> | undefined {
  return transactionManager.getTransaction(id)
}

/**
 * Hook to get all active transactions
 */
export function useActiveTransactions(): Map<
  string,
  ActorRefFrom<typeof transactionMachine>
> {
  const { transactions } = useTransactionManager()
  return transactions
}

/**
 * Hook to get recovered transactions (pending transactions from IndexedDB)
 */
export function useRecoveredTransactions(): PersistedTransaction[] {
  const [recovered, setRecovered] = useState<PersistedTransaction[]>([])

  useEffect(() => {
    getPendingTransactions()
      .then((pending) => {
        setRecovered(pending)
      })
      .catch((error) => {
        logger.error('Failed to get recovered transactions', error)
      })
  }, [])

  return recovered
}
