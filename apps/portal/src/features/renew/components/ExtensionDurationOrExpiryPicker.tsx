import { CalendarIcon, HashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RegistrationDurationPicker } from '@/features/register/components/RegistrationDurationPicker'
import { RegistrationExpiryDatePicker } from '@/features/register/components/RegistrationExpiryDatePicker'
import {
  getMaxExpiryDateForPicker,
  getMinExpiryDateForPicker,
  plainDateToDate,
} from '@/features/register/utils/registrationDuration'
import {
  CONTRACT_SECONDS_PER_YEAR,
  MAX_REGISTRATION_YEARS,
} from '@/lib/constants/duration'
import { cn } from '@/lib/utils'
import {
  getExtensionBaseDate,
  getExtensionDisplayedYears,
  getExtensionDurationForToggledSpan,
  getExtensionTargetDate,
} from '../utils/extensionDurationPicker'

export type ExtensionSpanType = 'years' | 'date'

type ExtensionDurationOrExpiryPickerProps = {
  readonly disabled?: boolean
  readonly duration: number
  readonly setDuration: (duration: number) => void
  /** Base date for duration calculations (use name's current expiry for renewal) */
  readonly expiryDate?: Date | null
  readonly spanType: ExtensionSpanType
  readonly setSpanType: (type: ExtensionSpanType) => void
  /** Name used to compute per-year prices for preset chips. Chips hidden if absent. */
  readonly name?: string
}

export const ExtensionDurationOrExpiryPicker = ({
  disabled = false,
  duration,
  setDuration,
  expiryDate,
  spanType,
  setSpanType,
  name,
}: ExtensionDurationOrExpiryPickerProps) => {
  const baseDate = getExtensionBaseDate(expiryDate)
  const targetDate = getExtensionTargetDate({ baseDate, duration, spanType })
  const displayedYears = getExtensionDisplayedYears({
    baseDate,
    duration,
    spanType,
    targetDate,
  })

  const handleSpanTypeToggle = () => {
    setDuration(
      getExtensionDurationForToggledSpan({
        baseDate,
        displayedYears,
        spanType,
      }),
    )
    setSpanType(spanType === 'years' ? 'date' : 'years')
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 border border-border rounded-lg px-6 pb-6 pt-4',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">
            {spanType === 'years' ? 'For' : 'Until'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpanTypeToggle}
            className="gap-1 text-primary"
          >
            <span className="text-xs font-normal">
              {spanType === 'years' ? 'Pick by date' : 'Choose length'}
            </span>
            {spanType === 'years' ? (
              <CalendarIcon className="size-3" />
            ) : (
              <HashIcon className="size-3" />
            )}
          </Button>
        </div>

        {spanType === 'years' ? (
          <RegistrationDurationPicker
            value={displayedYears}
            max={MAX_REGISTRATION_YEARS}
            onChange={(years) => setDuration(years)}
            name={name}
          />
        ) : (
          <RegistrationExpiryDatePicker
            date={targetDate}
            onDateChange={(date) =>
              setDuration(plainDateToDate(date).getTime())
            }
            onYearsPresetSelect={(years) =>
              setDuration(
                plainDateToDate(baseDate).getTime() +
                  years * CONTRACT_SECONDS_PER_YEAR * 1000,
              )
            }
            minDate={getMinExpiryDateForPicker(baseDate)}
            maxDate={getMaxExpiryDateForPicker(baseDate)}
            name={name}
          />
        )}
      </div>
    </div>
  )
}
