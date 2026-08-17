import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectionCheckboxProps {
  readonly checked: boolean
  readonly indeterminate?: boolean
  readonly onToggle: () => void
  readonly ariaLabel: string
}

export const SelectionCheckbox = ({
  checked,
  indeterminate = false,
  onToggle,
  ariaLabel,
}: SelectionCheckboxProps) => {
  const active = checked || indeterminate

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={indeterminate ? 'mixed' : checked}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors',
        active
          ? 'border-ens-lapis-500 bg-transparent text-ens-lapis-500'
          : 'border-ens-quartz-250 bg-ens-quartz-0 text-transparent hover:border-ens-quartz-350',
      )}
      onClick={onToggle}
      type="button"
    >
      {indeterminate ? (
        <Minus className="size-3.5" strokeWidth={3} />
      ) : (
        <Check className="size-3.5" strokeWidth={3} />
      )}
    </button>
  )
}
