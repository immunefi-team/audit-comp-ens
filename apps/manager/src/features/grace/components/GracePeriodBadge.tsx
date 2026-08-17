import { Trans } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'

export const GracePeriodBadge = () => (
  <span className="inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#fffddc] px-2 font-sans text-ens-citrine-500 text-xs leading-none">
    <Trans>Grace period</Trans>
    <MSymbol
      className="ms-opsz-12 ms-wght-400 text-sm"
      symbol="calendar_month"
    />
  </span>
)
