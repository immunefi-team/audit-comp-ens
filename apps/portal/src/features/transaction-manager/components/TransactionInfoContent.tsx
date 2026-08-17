import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Transaction, TransactionModalContentState } from '../types'
import { EstimatedGasCost } from './EstimatedGasCost'

type TransactionInfoContentProps = {
  readonly transaction: Transaction
  readonly actor: TransactionMachineActor | undefined
  readonly setTransactionModalContentState: (
    state: TransactionModalContentState,
  ) => void
}

export const TransactionInfoContent = ({
  transaction,
  actor,
  setTransactionModalContentState,
}: TransactionInfoContentProps) => {
  return (
    <>
      <DialogHeader className="py-3 border-b mb-0">
        <DialogTitle className="flex items-center gap-1 text-base font-medium">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() =>
              setTransactionModalContentState({ type: 'overview' })
            }
          >
            <ArrowLeft className="size-3" /> Back
          </Button>
          {transaction.title}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex p-4 border-b items-start gap-2 rounded-sm">
          <ArrowRight className="size-5 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-base font-medium whitespace-normal leading-snug">
              {transaction.transactionName}
            </h3>
            <p className="text-xs font-mono">
              {actor?.getSnapshot().value === 'success'
                ? 'Actual cost'
                : 'Est. cost'}
              : <EstimatedGasCost actor={actor} intent={transaction.intent} />
            </p>
            {transaction.steps && transaction.steps.length > 0 && (
              <ul className="flex flex-col gap-1 pb-4 text-sm mt-3">
                {transaction.steps.map((step) => (
                  <li key={step} className="flex items-center gap-1.5">
                    <ArrowRight className="size-3 shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
