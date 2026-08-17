import { Trans } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'

export type PriceCooldownPillProps = {
  className?: string
}

export const PriceCooldownPill = ({ className }: PriceCooldownPillProps) => (
  <span
    className={cn(
      'inline-flex h-5 items-center justify-center gap-1.5 rounded-xl bg-ens-lapis-100 px-2 py-1 text-ens-lapis-500 text-xs',
      className,
    )}
  >
    <Trans>Price cooldown</Trans>
    <MSymbol className="ms-opsz-16 ms-wght-400" symbol="hourglass" />
  </span>
)

PriceCooldownPill.displayName = 'PriceCooldownPill'
