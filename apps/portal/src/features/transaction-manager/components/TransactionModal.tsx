import { useActiveTransactions } from '@ens-apps/transaction-manager'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useActiveTransactionState } from '../hooks/useActiveTransactionState'
import { useAutoAdvanceTransaction } from '../hooks/useAutoAdvanceTransaction'
import { useTransactionModal } from '../hooks/useTransactionModal'
import type { Transaction, TransactionModalContentState } from '../types'
import { getTransactionById } from '../utils/getTransactionById'
import { TransactionInfoContent } from './TransactionInfoContent'
import { TransactionStateContent } from './TransactionStateContent'
import { TransactionsOverviewContent } from './TransactionsOverviewContent'

type TransactionModalProps = {
  readonly transactions: readonly Transaction[]
}

export const TransactionModal = ({ transactions }: TransactionModalProps) => {
  const txState = useActiveTransactionState()
  const activeTransactionsMap = useActiveTransactions()

  const { isOpen, closeModal, clearTransaction } = useTransactionModal()
  const autoAdvanceTxId =
    isOpen && txState?.machineState === 'success' ? txState.txId : null

  const [transactionModalContentState, setTransactionModalContentState] =
    useState<TransactionModalContentState>({ type: 'overview' })

  // When the parent swaps in a different set of transactions — e.g. a sidebar
  // switching from its "set address" flow to its "set primary name" flow — a
  // lingering `info`/`state` view can still reference the previous flow's
  // transaction id, which `getTransactionById` would then throw on ("... not
  // found"). Fall back to the overview in that case. This "adjust state during
  // render" can't loop: once reset to overview there's no id left to reconcile.
  if (
    transactionModalContentState.type !== 'overview' &&
    !transactions.some(
      (t) => t.id === transactionModalContentState.transactionId,
    )
  ) {
    setTransactionModalContentState({ type: 'overview' })
  }

  useAutoAdvanceTransaction(autoAdvanceTxId, transactions)

  const handleClose = () => {
    closeModal()
  }

  if (!transactions.length) return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose()
          // Only clear when transaction has failed - don't clear pending (tx may still be in wallet)
          // or success (user might want to reopen and see the result)
          if (txState?.error) {
            clearTransaction()
          }
        }
      }}
    >
      <DialogContent
        className={cn(
          'sm:max-w-[420px] max-h-[85vh] overflow-x-hidden overflow-y-auto space-y-3 transition-all duration-150 pt-10',
          transactionModalContentState.type === 'info' && 'p-0 gap-0',
        )}
        showCloseButton={transactionModalContentState.type !== 'info'}
      >
        {match(transactionModalContentState)
          .with({ type: 'overview' }, () => (
            <TransactionsOverviewContent
              transactions={transactions}
              txState={txState}
              activeTransactionsMap={activeTransactionsMap}
              setTransactionModalContentState={setTransactionModalContentState}
            />
          ))
          .with({ type: 'info' }, (state) => (
            <TransactionInfoContent
              transaction={getTransactionById(
                transactions,
                state.transactionId,
              )}
              actor={activeTransactionsMap.get(state.transactionId)}
              setTransactionModalContentState={setTransactionModalContentState}
            />
          ))
          .with({ type: 'state' }, (state) => (
            <TransactionStateContent
              transactions={transactions}
              activeTransactionId={state.transactionId}
              txState={txState}
              activeTransactionsMap={activeTransactionsMap}
              setTransactionModalContentState={setTransactionModalContentState}
            />
          ))
          .exhaustive()}
      </DialogContent>
    </Dialog>
  )
}
