import { Trans } from '@lingui/react/macro'
import { addDays, format } from 'date-fns'
import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Selection } from '../types'

/**
 * "Renew to date instead" link + calendar. The calendar jumps to and is bounded
 * by `minSelectableDate` (the minimum renewal duration after every name's expiry).
 */
export const RenewToDatePopover = ({
  selection,
  minSelectableDate,
  onPickDate,
}: {
  readonly selection: Selection
  readonly minSelectableDate: Date
  readonly onPickDate: (date: Date) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const targetDate =
    selection.kind === 'custom' ? new Date(selection.targetMs) : undefined

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    const midnight = new Date(date)
    midnight.setHours(0, 0, 0, 0)
    onPickDate(midnight)
    setIsOpen(false)
  }

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 font-sans text-ens-lapis-core text-xs hover:opacity-80"
          type="button"
        >
          {targetDate ? (
            <Trans>Renew to {format(targetDate, 'MMM d, yyyy')}</Trans>
          ) : (
            <Trans>Renew to date instead</Trans>
          )}
          <MSymbol
            className="ms-opsz-18 text-lg leading-none"
            symbol="calendar_month"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          defaultMonth={targetDate ?? minSelectableDate}
          disabled={(date) => {
            const minDate = new Date(minSelectableDate)
            minDate.setHours(0, 0, 0, 0)
            const dateToCheck = new Date(date)
            dateToCheck.setHours(0, 0, 0, 0)
            return dateToCheck.getTime() < minDate.getTime()
          }}
          endMonth={addDays(minSelectableDate, 365 * 100)}
          minimumDate={minSelectableDate}
          onMinimum={() => handleSelect(minSelectableDate)}
          onSelect={handleSelect}
          selected={targetDate}
          showMinimumButton
          startMonth={minSelectableDate}
        />
      </PopoverContent>
    </Popover>
  )
}
