import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RegistrationDurationPresets } from '@/features/register/components/RegistrationDurationPresets'
import {
  getDurationFromPickerDate,
  getYearsFromDuration,
  isDateWithinCalendarRange,
} from '@/features/register/utils/registrationDuration'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/formatting/formatDateTime'
import { dateToPlainDate, plainDateToDate } from '@/utils/temporal'

type RegistrationExpiryDatePickerProps = {
  readonly date: Temporal.PlainDate
  readonly onDateChange: (date: Temporal.PlainDate) => void
  readonly onYearsPresetSelect: (years: number) => void
  readonly minDate: Temporal.PlainDate
  readonly maxDate: Temporal.PlainDate
  readonly name?: string
}

export const RegistrationExpiryDatePicker = ({
  date,
  onDateChange,
  onYearsPresetSelect,
  minDate,
  maxDate,
  name,
}: RegistrationExpiryDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useIsMobile()

  const displayValue = formatDateTime(date)

  const selectedDateForCalendar = plainDateToDate(date)
  const minDateForCalendar = plainDateToDate(minDate)
  const maxDateForCalendar = plainDateToDate(maxDate)

  const handleSelect = (d: Date | undefined) => {
    if (!d) return
    const picked = dateToPlainDate(d)
    if (Temporal.PlainDate.compare(picked, date) === 0) {
      setIsOpen(false)
      return
    }
    onDateChange(picked)
    setIsOpen(false)
  }

  const handlePresetSelect = (spanValue: number) => {
    onYearsPresetSelect(spanValue)
  }

  const disabled = (date: Date) => {
    return !isDateWithinCalendarRange(dateToPlainDate(date), minDate, maxDate)
  }

  return (
    <div className="space-y-5">
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <button
            id="registration-expiry-date"
            type="button"
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 text-left text-foreground outline-none transition-[color,box-shadow] hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2',
            )}
          >
            <span className="flex-1 truncate text-2xl font-medium">
              {displayValue}
            </span>
            <span
              className={cn(
                buttonVariants({ size: 'icon', variant: 'outline' }),
                'size-8',
              )}
            >
              <CalendarIcon className="size-3 text-primary" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border border-border"
          align={isMobile ? 'center' : 'start'}
          side={isMobile ? 'bottom' : 'right'}
          sideOffset={isMobile ? 0 : 40}
        >
          <Calendar
            captionLayout="dropdown"
            defaultMonth={selectedDateForCalendar}
            disabled={disabled}
            endMonth={maxDateForCalendar}
            formatters={{
              formatMonthDropdown: (d) =>
                d.toLocaleString('default', { month: 'long' }),
              formatYearDropdown: (d) => d.getFullYear().toString(),
            }}
            mode="single"
            onSelect={handleSelect}
            required
            selected={selectedDateForCalendar}
            startMonth={minDateForCalendar}
          />
        </PopoverContent>
      </Popover>
      {name ? (
        <RegistrationDurationPresets
          value={Math.round(
            getYearsFromDuration(getDurationFromPickerDate(date)),
          )}
          onSelect={handlePresetSelect}
          name={name}
        />
      ) : null}
    </div>
  )
}
