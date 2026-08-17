import { Trans } from '@lingui/react/macro'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { RowStatus, SummaryRow } from '../types'
import { BeadProgressBar } from './BeadProgressBar'
import { NamesBreakdown } from './NamesBreakdown'

/** In-progress view: bead progress bar + the names breakdown + busy button. */
export const RenewingStep = ({
  rows,
  total,
  statuses,
}: {
  readonly rows: readonly SummaryRow[]
  readonly total: number
  readonly statuses: Readonly<Record<string, RowStatus>>
}) => {
  const count = rows.length
  const doneCount = rows.filter((row) => statuses[row.label] === 'done').length
  const activeCount = rows.filter(
    (row) => statuses[row.label] === 'active',
  ).length
  const progress =
    count > 0 ? ((doneCount + activeCount * 0.5) / count) * 100 : 0

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3 pr-8">
          <DialogTitle className="shrink-0 font-normal font-sans text-base text-ens-lapis-core">
            <Trans>Renewing names</Trans>
          </DialogTitle>
          <BeadProgressBar progress={progress} />
        </div>
      </DialogHeader>

      <NamesBreakdown rows={rows} total={total} />

      <Button
        className="pointer-events-none w-full uppercase"
        size="lg"
        type="button"
        variant="blue"
      >
        <Trans>Renewing names</Trans>
        <Loader2 aria-hidden className="size-4 animate-spin" />
      </Button>
    </>
  )
}
