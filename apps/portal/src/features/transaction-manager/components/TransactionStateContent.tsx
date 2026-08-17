import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Hourglass,
  SquareArrowOutUpRight,
  XCircle,
} from 'lucide-react'
import { match } from 'ts-pattern'
import { useChainId } from 'wagmi'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TransactionErrorAlert } from '@/features/registry/components/TransactionErrorAlert'
import { cn } from '@/lib/utils'
import { wagmiConfig } from '@/lib/wagmi'
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer/getBlockExplorerTxUrl'
import type { ActiveTransactionState } from '../hooks/useActiveTransactionState'
import type { Transaction, TransactionModalContentState } from '../types'
import { getActiveTransaction } from '../utils/getActiveTransaction'
import { getStatus } from '../utils/getStatus'
import { getTransactionById } from '../utils/getTransactionById'
import { shouldShowWaitCountdown } from '../utils/shouldShowWaitCountdown'
import { TransactionFlowProgressBar } from './TransactionFlowProgressBar'
import { TransactionWaitCountdown } from './TransactionWaitCountdown'

type TransactionStateContentProps = {
  readonly transactions: readonly Transaction[]
  readonly activeTransactionId: string
  readonly txState: ActiveTransactionState | undefined
  readonly activeTransactionsMap: Map<string, TransactionMachineActor>
  readonly setTransactionModalContentState: (
    state: TransactionModalContentState,
  ) => void
}

export const TransactionStateContent = ({
  transactions,
  activeTransactionId,
  txState,
  activeTransactionsMap,
  setTransactionModalContentState,
}: TransactionStateContentProps) => {
  const chainId = useChainId()

  const activeTransaction = getActiveTransaction(transactions, txState)
  const activeTxStatus = getStatus(activeTransaction.id, activeTransactionsMap)
  const activeIndex = transactions.findIndex(
    (t) => t.id === activeTransaction.id,
  )
  const hasNextTransaction =
    activeIndex >= 0 && activeIndex < transactions.length - 1

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {transactions.length === 1
            ? getTransactionById(transactions, activeTransactionId)?.title
            : 'Transaction flow'}
        </DialogTitle>
      </DialogHeader>

      <TransactionFlowProgressBar
        transactions={transactions}
        activeTransaction={activeTransaction}
        activeTransactionsMap={activeTransactionsMap}
      />

      <div className="flex flex-col gap-2">
        {transactions.map((transaction, index) => {
          const isPending = index > activeIndex
          const status = getStatus(transaction.id, activeTransactionsMap)

          const activeTxSnapshot = activeTransactionsMap
            .get(transaction.id)
            ?.getSnapshot()

          const txHash = activeTxSnapshot?.context?.hash

          const blockExplorerTxUrl = txHash
            ? getBlockExplorerTxUrl(wagmiConfig.chains, chainId, txHash)
            : undefined

          const txError = activeTxSnapshot?.context?.error

          return (
            <div
              key={transaction.id}
              className={cn(
                'flex flex-start gap-4 border border-border rounded-sm p-3.5',
                isPending && 'opacity-60',
              )}
            >
              <div className="mt-1 shrink-0">
                {match(status)
                  .with(undefined, () => (
                    <ArrowRight className="size-4 text-muted-foreground" />
                  ))
                  .with('success', () => (
                    <CheckCircle2 className="size-4 text-peridot-600" />
                  ))
                  .with('error', () => (
                    <XCircle className="size-4 text-garnet-600" />
                  ))
                  .otherwise(() => (
                    <Hourglass className="size-4 text-quartz-600 animate-spin" />
                  ))}
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium whitespace-normal leading-snug break-all min-w-0">
                    {transaction.transactionName}
                  </h3>
                  {blockExplorerTxUrl && (
                    <a
                      href={blockExplorerTxUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0"
                    >
                      <SquareArrowOutUpRight className="size-3" />
                    </a>
                  )}
                  {shouldShowWaitCountdown(
                    transaction,
                    index,
                    transactions,
                    activeTransactionsMap,
                  ) && transaction.waitUntil ? (
                    <TransactionWaitCountdown
                      waitUntil={transaction.waitUntil}
                    />
                  ) : null}
                </div>
                {transaction.steps && transaction.steps.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {transaction.steps.map((step) => (
                      <li key={step} className="flex items-center gap-1.5">
                        <ArrowRight className="size-3 shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                )}
                {txError && (
                  <TransactionErrorAlert
                    title="Transaction Error"
                    summary={txError?.message || 'An unknown error occurred.'}
                    details={txError?.stack || 'No stack trace available.'}
                    txHash={txHash}
                    txHashLabel="Transaction hash:"
                    showIcon={false}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTransactionModalContentState({ type: 'overview' })}
        >
          <ArrowLeft className="size-4" />
        </Button>
        {match(activeTxStatus)
          .with(undefined, () => (
            <Button
              variant="default"
              className="flex-1"
              onClick={activeTransaction.onStart}
            >
              Open wallet
            </Button>
          ))
          .with('success', () => (
            <Button
              variant="default"
              className="flex-1"
              onClick={activeTransaction.onDone}
            >
              {hasNextTransaction ? 'Next' : 'Done'}
            </Button>
          ))
          .with('error', () => (
            <Button
              variant="default"
              className="flex-1"
              onClick={activeTransaction.onStart}
            >
              Try again
            </Button>
          ))
          .otherwise(() => (
            <Button variant="ghost" className="flex-1 bg-muted" disabled>
              Waiting...
            </Button>
          ))}
      </div>
    </>
  )
}
