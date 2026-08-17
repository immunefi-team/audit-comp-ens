import { Trans } from '@lingui/react/macro'
import {
  addMonths,
  addSeconds,
  differenceInCalendarDays,
  format,
  startOfDay,
} from 'date-fns'
import { memo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getDurationExpiryDateForDisplay } from '@/features/register-v2/utils/time'
import { MIN_REGISTER_DURATION_SECONDS } from '@/features/shared/registration/pricing'
import { cn } from '@/lib/utils'

const getDurationFromSelectedDate = (date: Date, referenceDate: Date) =>
  Math.max(
    MIN_REGISTER_DURATION_SECONDS,
    differenceInCalendarDays(startOfDay(date), startOfDay(referenceDate)) *
      86_400,
  )

export const DurationCustomRow = memo(function DurationCustomRow({
  selectedDuration,
  onDurationSet,
  isSelected,
  type,
  referenceDate: referenceDateProp,
}: {
  selectedDuration: number
  onDurationSet: (duration: number) => void
  isSelected: boolean
  type: 'register' | 'renew'
  /** Registration: defaults to start of today. Renewal: pass current on-chain expiry (same as PricingSummaryCard). */
  referenceDate?: Date
}) {
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
  const [defaultReferenceDate] = useState(() => {
    const value = new Date()
    value.setHours(0, 0, 0, 0)
    return value
  })
  const referenceDate = referenceDateProp ?? defaultReferenceDate
  const expirationDate = getDurationExpiryDateForDisplay(
    selectedDuration,
    referenceDate,
  )

  const minSelectableDate = addSeconds(
    referenceDate,
    MIN_REGISTER_DURATION_SECONDS,
  )

  return (
    <Popover onOpenChange={setIsDatePopoverOpen} open={isDatePopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'group flex w-full cursor-pointer flex-col items-start justify-between gap-3 rounded-lg md:flex-row md:items-center',
            'border-[#DEDEDF] border-[0.5px] bg-neutral-50 p-5 transition-all focus-within:border-ens-lapis-900 hover:border-ens-lapis-900 aria-pressed:border-ens-lapis-900 max-md:px-3',
            isSelected && 'border-ens-lapis-900',
          )}
          type="button"
        >
          <div className="whitespace-nowrap font-normal text-base text-ens-blue-dark leading-none tracking-tighter md:text-2xl">
            {type === 'register' ? (
              <Trans>Register to date</Trans>
            ) : (
              <Trans>Renew to date</Trans>
            )}
          </div>
          <PopoverAnchor asChild>
            <div className="flex w-full items-center justify-between gap-1.5 rounded border border-ens-gray-three bg-white p-3 transition-colors group-data-[state=open]:border-ens-blue md:min-w-fit md:max-w-1/3 md:gap-3 md:px-5 md:py-4">
              <span className="font-normal text-ens-blue-dark text-lg leading-ens-none">
                {format(expirationDate, 'MMMM d, yyyy')}
              </span>
              <MSymbol
                className="ms-opsz-18 ms-wght-400 text-[#A0A4A6] transition-colors group-data-[state=open]:text-ens-lapis-core"
                symbol="calendar_month"
              />
            </div>
          </PopoverAnchor>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          defaultMonth={expirationDate}
          disabled={(date) => {
            const minDate = new Date(minSelectableDate)
            minDate.setHours(0, 0, 0, 0)
            const dateToCheck = new Date(date)
            dateToCheck.setHours(0, 0, 0, 0)
            return dateToCheck.getTime() < minDate.getTime()
          }}
          endMonth={addMonths(new Date(), 1200)}
          minimumDate={minSelectableDate}
          onMinimum={() => {
            const minDate = new Date(minSelectableDate)
            minDate.setHours(0, 0, 0, 0)
            onDurationSet(getDurationFromSelectedDate(minDate, referenceDate))
          }}
          onSelect={(date) => {
            if (!date) {
              return
            }
            date.setHours(0, 0, 0, 0)
            onDurationSet(getDurationFromSelectedDate(date, referenceDate))
          }}
          selected={expirationDate}
          showMinimumButton
          startMonth={minSelectableDate}
        />
      </PopoverContent>
    </Popover>
  )
})
