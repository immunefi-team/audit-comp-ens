import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBulkRenew } from '../hooks/useBulkRenew'
import { useBulkRenewSubmit } from '../hooks/useBulkRenewSubmit'
import type { BulkRenewName, Selection, SummaryRow } from '../types'
import { DurationPresets } from './DurationPresets'
import { FailureStep } from './FailureStep'
import { NamesBreakdown } from './NamesBreakdown'
import { PaymentMethodSection } from './PaymentMethodSection'
import { RenewingStep } from './RenewingStep'
import { RenewToDatePopover } from './RenewToDatePopover'
import { SuccessStep } from './SuccessStep'

const dialogTitleClassName =
  'text-left font-normal font-sans text-ens-quartz-900 text-xl tracking-[-0.4px]'

type Step = 'summary' | 'confirm'

interface BulkRenewDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly names: readonly BulkRenewName[]
  /** Called once the batch has successfully renewed (e.g. to clear selection). */
  readonly onRenewed?: () => void
}

export const BulkRenewDialog = ({
  open,
  onOpenChange,
  names,
  onRenewed,
}: BulkRenewDialogProps) => {
  const { t } = useLingui()
  const [step, setStep] = useState<Step>('summary')
  const [selection, setSelection] = useState<Selection>({
    kind: 'preset',
    years: 1,
  })
  const [selectedToken, setSelectedToken] = useState<SUPPORTED_TOKEN>('USDC')

  const [receipt, setReceipt] = useState<{
    readonly rows: readonly SummaryRow[]
    readonly total: number
  } | null>(null)

  const {
    minSelectableDate,
    grandTotal,
    sumPriceRaw,
    summaryRows,
    renewItems,
    presetSummaries,
    payment,
  } = useBulkRenew({ names, selection, selectedToken, open })

  const submit = useBulkRenewSubmit()

  const count = names.length
  const durationLabel = match(selection)
    .with({ kind: 'preset' }, ({ years }) =>
      years === 1 ? t`1 year` : t`${years} years`,
    )
    .with({ kind: 'custom' }, ({ targetMs }) =>
      format(new Date(targetMs), 'MMM d, yyyy'),
    )
    .exhaustive()

  // Start every fresh open from a clean slate — otherwise a leftover terminal
  // phase (success/error) from a previous run would render over a new selection.
  const { reset } = submit
  useEffect(() => {
    if (open) {
      setStep('summary')
      setReceipt(null)
      reset()
    }
  }, [open, reset])

  const isSubmitting =
    submit.phase === 'preparing' ||
    submit.phase === 'authorizing' ||
    submit.phase === 'renewing'

  // Drives both which body renders and the crossfade key.
  const view = match(submit.phase)
    .with('success', () => 'success' as const)
    .with('error', () => 'error' as const)
    .with('preparing', 'authorizing', 'renewing', () => 'renewing' as const)
    .otherwise(() => step)

  const handleOpenChange = (next: boolean) => {
    // Allow closing while renewing (the txs continue), but only reset the flow
    // when it isn't mid-transaction.
    if (!next && !isSubmitting) {
      setStep('summary')
      submit.reset()
    }
    onOpenChange(next)
  }

  const handleConfirm = () => {
    setReceipt({ rows: summaryRows, total: grandTotal })
    submit.submit({ items: renewItems, token: selectedToken, sumPriceRaw })
  }

  const receiptSummary = receipt ?? { rows: summaryRows, total: grandTotal }

  // No smart-account gate: bulk renewal takes the direct-wallet route (the
  // registrar charges `msg.sender`, and the scoped HCA session does not
  // allowlist `renew`), so it works wherever a wallet is connected — including
  // the EOA fork. Each name is its own transaction rather than one atomic batch.
  const renderBody = (): ReactNode => {
    if (submit.phase === 'success') {
      return (
        <SuccessStep
          onDone={() => {
            onRenewed?.()
            handleOpenChange(false)
          }}
          rows={receiptSummary.rows}
          total={receiptSummary.total}
        />
      )
    }
    if (submit.phase === 'error') {
      return (
        <FailureStep
          errorMessage={submit.errorMessage}
          onBack={submit.reset}
          onRetry={handleConfirm}
        />
      )
    }
    if (isSubmitting) {
      return (
        <RenewingStep
          rows={receiptSummary.rows}
          statuses={submit.statuses}
          total={receiptSummary.total}
        />
      )
    }
    if (step === 'confirm') {
      return (
        <>
          <DialogHeader>
            <DialogTitle className={dialogTitleClassName}>
              <Trans>Confirm renewal</Trans>
            </DialogTitle>
          </DialogHeader>

          <NamesBreakdown rows={summaryRows} total={grandTotal} />

          <PaymentMethodSection
            isConnected={payment.isConnected}
            isLoadingBalances={payment.isLoadingBalances}
            onSelectCoin={setSelectedToken}
            priceUSD={grandTotal}
            selectedToken={selectedToken}
            stablecoinBalances={payment.stablecoinBalances}
          />

          <Button
            className="w-full uppercase"
            disabled={!payment.canConfirm}
            onClick={handleConfirm}
            size="lg"
            type="button"
          >
            <Trans>Confirm</Trans>
          </Button>
        </>
      )
    }
    return (
      <>
        <DialogHeader>
          <DialogTitle className={dialogTitleClassName}>
            <Plural
              one="Renew # name for"
              other="Renew # names for"
              value={count}
            />{' '}
            <span className="text-ens-lapis-core">{durationLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <DurationPresets
          onSelectPreset={(years) => setSelection({ kind: 'preset', years })}
          presetSummaries={presetSummaries}
          selection={selection}
        />

        <div className="flex justify-end">
          <RenewToDatePopover
            minSelectableDate={minSelectableDate}
            onPickDate={(date) =>
              setSelection({ kind: 'custom', targetMs: date.getTime() })
            }
            selection={selection}
          />
        </div>

        <NamesBreakdown rows={summaryRows} total={grandTotal} />

        <Button
          className="w-full uppercase"
          onClick={() => setStep('confirm')}
          size="lg"
          type="button"
          variant="lightBlue"
        >
          <Trans>Next</Trans>
        </Button>
      </>
    )
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden px-6 py-4 sm:max-w-[588px] sm:px-11 sm:py-8"
        showCloseButton
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-col gap-5"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={view}
            transition={{ duration: 0.2 }}
          >
            {renderBody()}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
