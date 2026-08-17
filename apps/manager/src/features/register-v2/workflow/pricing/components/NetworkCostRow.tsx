import { Trans, useLingui } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { tw } from '@/utils/tailwind'

/**
 * The execution cost of the two on-chain legs (commit + register), which the
 * wallet funds up front alongside the rent.
 *
 * Shown because the standalone-HCA route debits `rent + networkFee` under a
 * SINGLE permit — hiding it is what let wallets holding between the rent and
 * the budget clear checkout and then fail the commit simulation. Rendered as
 * its own white card inside the name card, per design (node 3867:125909).
 */
export const NetworkCostRow = ({
  networkFee,
  isLoading,
}: {
  /** Undefined while the budget is still being quoted. */
  networkFee: number | undefined
  isLoading: boolean
}) => {
  const { t } = useLingui()

  return (
    <div className="w-full rounded-xl bg-ens-quartz-0 p-4">
      <div
        className={tw(
          'flex w-full items-start justify-between gap-2',
          'text-base text-ens-quartz-900',
          isLoading && 'animate-pulse',
        )}
      >
        <span>
          <Trans>Network cost</Trans>
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">
            {networkFee === undefined ? '—' : formatUsd(networkFee)}
          </span>
          <Tooltip>
            <TooltipTrigger
              aria-label={t`What is the network cost?`}
              className="flex items-center text-ens-quartz-500"
              type="button"
            >
              <MSymbol className="ms-opsz-20 ms-wght-400" symbol="info" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-center">
              <Trans>
                An estimate of what the two on-chain transactions that register
                your name will cost. It is collected together with the rent, in
                the same approval.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </span>
      </div>
    </div>
  )
}
