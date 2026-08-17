import { Trans } from '@lingui/react/macro'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'

/**
 * The headline figure at the foot of the payment screen — what actually leaves
 * the wallet, per design (node 3867:126050).
 *
 * With a funding budget quoted that is `rent + networkFee`, and the fee half is
 * an estimate, so the figure is an upper bound: hence "up to". Without a budget
 * the total is exact rent and the hedge would be a lie, so it is dropped.
 *
 * The `tracking-*` values are Figma-spec (node 3867:126050) and stay arbitrary:
 * `theme.css` defines no letter-spacing tokens, and Tailwind's default scale is
 * em-relative (`tracking-tight` is -0.45px at this size, not -0.36px), so no
 * utility expresses them.
 */
export const PaymentTotalRow = ({
  total,
  isEstimate,
}: {
  total: number | undefined
  isEstimate: boolean
}) => (
  <div className="flex w-full items-baseline justify-between">
    <span className="text-ens-quartz-350 text-lg leading-ens-none tracking-[-0.36px]">
      <Trans>Total</Trans>
    </span>
    <div className="flex items-center gap-2">
      <p className="tracking-[0.36px]">
        {isEstimate && (
          <span className="text-base text-ens-quartz-350">
            <Trans>up to</Trans>{' '}
          </span>
        )}
        <span className="text-ens-quartz-900 text-xl tabular-nums">
          {formatUsd(total ?? 0)}
        </span>
      </p>
      <span className="text-ens-quartz-350 text-lg leading-ens-none tracking-[-0.36px]">
        USD
      </span>
    </div>
  </div>
)
