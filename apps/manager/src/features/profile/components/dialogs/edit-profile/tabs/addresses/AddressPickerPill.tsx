import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AddressPickerPillProps {
  readonly active: boolean
  readonly disabled?: boolean
  readonly icon?: ReactNode
  readonly label: string
  readonly onClick: () => void
  readonly variant?: 'pill' | 'text'
}

export const AddressPickerPill = ({
  active,
  disabled,
  icon,
  label,
  onClick,
  variant = 'pill',
}: AddressPickerPillProps) => (
  <button
    className={cn(
      'flex h-7 min-w-0 max-w-full shrink-0 items-center gap-1 rounded-[25px] font-sans text-xs leading-[1.2] tracking-[0.12px] transition-colors',
      variant === 'pill' &&
        'border-[0.5px] pt-1.5 pr-1.5 pb-1.5 pl-2.5 text-ens-quartz-900 hover:border-[#d4d4d4] hover:bg-ens-quartz-50',
      variant === 'pill' &&
        active &&
        'border-ens-quartz-500 bg-ens-quartz-500 text-white hover:bg-[#504e4b]',
      variant === 'pill' && !active && 'border-ens-quartz-200 bg-white',
      variant === 'text' &&
        'border border-transparent bg-transparent pt-1.5 pr-1.5 pb-1.5 pl-2.5 text-ens-quartz-900 hover:text-ens-quartz-500',
      disabled && 'cursor-not-allowed opacity-50',
    )}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {icon}
    <span className="min-w-0 truncate capitalize">{label}</span>
    {active ? (
      <Minus className="size-3.5 shrink-0 text-current" strokeWidth={2} />
    ) : (
      <Plus className="size-3.5 shrink-0 text-current" strokeWidth={2} />
    )}
  </button>
)
