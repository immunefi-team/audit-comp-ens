import { Trans } from '@lingui/react/macro'
import { format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import type { SummaryRow } from '../types'
import { formatUsdAmount } from '../utils/pricing'
import { NameAvatar } from './NameAvatar'

/** Scrollable per-name list of expiry ranges + subtotals, with a pinned total. */
export const NamesBreakdown = ({
  rows,
  total,
}: {
  readonly rows: readonly SummaryRow[]
  readonly total: number
}) => (
  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-ens-quartz-150">
    <div className="flex max-h-[280px] flex-col gap-0 overflow-y-auto">
      {rows.map((row) => (
        <div
          className="flex flex-col gap-2 border-ens-quartz-150 border-b p-4 last:border-none"
          key={row.key}
        >
          <div className="flex items-center gap-2 font-sans text-ens-quartz-380 text-xs">
            <span className="font-normal font-sans text-ens-quartz-400 text-xs">
              {format(row.startDate, 'MMMM d, yyyy')}
            </span>
            <ArrowRight
              className="size-3.5 text-ens-quartz-400"
              strokeWidth={2}
            />
            <span className="font-normal font-sans text-ens-quartz-700 text-xs">
              {format(row.endDate, 'MMMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <NameAvatar name={row.label} preview={row.preview} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium font-semi-mono text-base text-ens-quartz-900">
                  {row.displayName}
                </span>
                <span className="font-sans text-ens-quartz-350 text-sm">
                  <Trans>Subtotal:</Trans>
                </span>
              </div>
            </div>
            <span className="shrink-0 font-sans text-ens-quartz-900 text-sm">
              {row.subtotal === undefined ? '—' : formatUsdAmount(row.subtotal)}
            </span>
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between border-ens-quartz-150 border-t px-4 py-3 font-medium font-sans text-ens-lapis-900 text-xl">
      <Trans>Total:</Trans>
      <span className="block">{formatUsdAmount(total)} USD</span>
    </div>
  </div>
)
