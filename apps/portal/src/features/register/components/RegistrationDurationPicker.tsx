import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { RegistrationDurationPresets } from './RegistrationDurationPresets'

type RegistrationDurationPickerProps = {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly min?: number
  readonly max?: number
  readonly className?: string
  /** Name used to compute per-year prices for preset chips. Chips hidden if absent. */
  readonly name?: string
}

export const RegistrationDurationPicker = ({
  value,
  onChange,
  min = 1,
  max = 9007199254740990,
  className,
  name,
}: RegistrationDurationPickerProps) => {
  const [isFocused, setIsFocused] = useState(false)

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    if (!Number.isNaN(parsed)) {
      const capped = Math.min(Math.max(parsed, min), max)
      onChange(capped)
    }
  }

  const handlePresetSelect = (years: number) => {
    const capped = Math.min(Math.max(years, min), max)
    onChange(capped)
  }

  const label = value === 1 ? '1.00 year' : `${value.toFixed(2)} years`

  return (
    <div className="space-y-5">
      <div
        className={cn('flex items-center gap-0', 'overflow-hidden', className)}
      >
        <div className="relative flex min-w-0 flex-1 items-start justify-between">
          <Input
            type="number"
            min={min}
            max={max}
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label={label}
            className={cn(
              'h-8 w-full min-w-0 border-0 bg-transparent p-0 text-start',
              'shadow-none focus-visible:ring-0 [appearance:textfield]',
              '[&::-webkit-inner-spin-button]:appearance-none',
              '[&::-webkit-outer-spin-button]:appearance-none',
              'text-2xl md:text-2xl rounded-none',
              isFocused && 'font-medium',
            )}
          />
          <span
            className={cn(
              'pointer-events-none absolute inset-0',
              'text-2xl font-medium',
              'flex items-center justify-start bg-background',
              isFocused && 'hidden',
            )}
          >
            {label}
          </span>
        </div>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleDecrement}
          disabled={value <= min}
          className="size-8 mr-1"
        >
          <Minus className="size-4" strokeWidth={2} />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={value >= max}
          className="size-8"
        >
          <Plus className="size-4" strokeWidth={2} />
        </Button>
      </div>
      {name ? (
        <RegistrationDurationPresets
          value={value}
          onSelect={handlePresetSelect}
          name={name}
        />
      ) : null}
    </div>
  )
}
