import { transactionManager } from '@ens-apps/transaction-manager'
import { useRouter } from '@tanstack/react-router'
import { createAtom, useAtom } from '@xstate/store-react'
import { useEffect } from 'react'

const transactionModalAtom = createAtom(false)

export const openTransactionModal = () => transactionModalAtom.set(true)
export const closeTransactionModal = () => transactionModalAtom.set(false)

export const useTransactionModal = () => {
  const isOpen = useAtom(transactionModalAtom)

  const clearTransaction = () => {
    transactionManager.clear()
  }

  return {
    isOpen,
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction,
  }
}

/**
 * Closes the transaction modal whenever the route changes.
 *
 * The modal open-state is a single app-wide atom shared by every
 * `TransactionModal`. Without this, a modal left open on one page (e.g. a
 * registration that redirects on success) keeps the atom `true`, so the next
 * page that mounts a `TransactionModal` — like the registry page's
 * "Deploy subregistry" flow — pops open on arrival without any user
 * interaction. Resetting on navigation scopes the open-state to a single page.
 */
export const useTransactionModalRouteReset = () => {
  const router = useRouter()

  useEffect(
    () => router.subscribe('onResolved', () => closeTransactionModal()),
    [router],
  )
}
