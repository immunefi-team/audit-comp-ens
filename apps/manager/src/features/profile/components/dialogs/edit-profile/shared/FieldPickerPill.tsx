import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldPickerPillProps {
  readonly active: boolean
  readonly className?: string
  readonly disabled?: boolean
  readonly icon: ReactNode
  readonly label: ReactNode
  readonly onClick: () => void
}

export const FieldPickerPill = ({
  active,
  className,
  disabled,
  icon,
  label,
  onClick,
}: FieldPickerPillProps) => (
  <button
    className={cn(
      'flex h-6.5 shrink-0 items-center gap-1 rounded-[25px] border-[0.5px] px-2 py-1.5 text-[14px] leading-[1.2] tracking-[0.12px] transition-colors',
      active
        ? 'border-ens-quartz-350 bg-ens-quartz-100 text-ens-quartz-500'
        : 'border-ens-quartz-200 bg-white text-ens-quartz-900 hover:bg-ens-quartz-50',
      disabled && 'cursor-not-allowed opacity-50',
      className,
    )}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {icon}
    <span className="capitalize">{label}</span>
  </button>
)
