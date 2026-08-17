import { MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'

export type DomainAttributePillVariant =
  | 'available'
  | 'premium-3'
  | 'premium-4'
  | 'cooldown'

export type DomainAttributePillProps = {
  label: string
  variant: DomainAttributePillVariant
  className?: string
}

const variantStyles: Record<DomainAttributePillVariant, string> = {
  available: 'bg-ens-green-light text-ens-green font-medium',
  'premium-3':
    'rounded-[14.182px] bg-[linear-gradient(94deg,#E9D4BC_2.94%,#8E6616_299.58%)] text-black font-medium',
  'premium-4':
    'rounded-[14.182px] bg-[linear-gradient(103deg,#E2E8F0_22.67%,#606262_287.71%)] text-black font-medium',
  cooldown: 'bg-ens-lapis-100 text-ens-lapis-500 font-medium',
}

export const DomainAttributePill = ({
  label,
  variant,
  className,
}: DomainAttributePillProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-[10px] rounded-xl px-2 py-1 text-xs',
        variantStyles[variant],
        className,
      )}
    >
      {label}
      {variant === 'cooldown' && (
        <MSymbol className="ms-opsz-14 ms-wght-400" symbol="hourglass" />
      )}
    </span>
  )
}

DomainAttributePill.displayName = 'DomainAttributePill'
