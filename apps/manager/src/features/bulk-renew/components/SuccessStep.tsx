import { Trans } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SummaryRow } from '../types'
import { BeadProgressBar } from './BeadProgressBar'
import { NamesBreakdown } from './NamesBreakdown'

/** Terminal success view: green check + title + full bead bar + receipt. */
export const SuccessStep = ({
  rows,
  total,
  onDone,
}: {
  readonly rows: readonly SummaryRow[]
  readonly total: number
  readonly onDone: () => void
}) => (
  <>
    <DialogHeader className="items-center gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-ens-peridot-400">
        <Check className="size-6 text-ens-quartz-0" strokeWidth={3} />
      </span>
      <DialogTitle className="text-center font-normal font-sans text-2xl text-ens-quartz-900 tracking-[-0.4px]">
        <Trans>Renewal Complete</Trans>
      </DialogTitle>
      <div className="mx-auto w-full max-w-sm">
        <BeadProgressBar progress={100} />
      </div>
    </DialogHeader>

    <NamesBreakdown rows={rows} total={total} />

    <Button
      className="w-full uppercase"
      onClick={onDone}
      size="lg"
      type="button"
      variant="lightBlue"
    >
      <Trans>Done</Trans>
    </Button>
  </>
)
