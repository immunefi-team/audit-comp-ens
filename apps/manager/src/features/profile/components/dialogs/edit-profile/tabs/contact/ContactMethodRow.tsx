import { MSymbol } from '@/components/ui/material-symbol'
import { IconRenderer } from '@/features/profile/components/IconRenderer'
import { getRecordDef } from '@/features/profile/data/records'
import { cn } from '@/lib/utils'
import type { ContactMethod } from './constants'
import { PrimaryContactButton } from './PrimaryContactButton'
import {
  contactErrorMessageClassName,
  contactErrorMessageIconClassName,
  contactErrorMessageIconSymbol,
} from './records'

interface ContactMethodRowProps {
  readonly disabled: boolean
  readonly errorMessage?: string
  readonly method: ContactMethod
  readonly noticeMessage?: string
  readonly onPrimaryChange: (method: ContactMethod, checked: boolean) => void
  readonly onValueChange: (method: ContactMethod, value: string) => void
  readonly primary: boolean
  readonly primaryDisabled: boolean
  readonly value: string
}

export const ContactMethodRow = ({
  disabled,
  errorMessage,
  method,
  noticeMessage,
  onPrimaryChange,
  onValueChange,
  primary,
  primaryDisabled,
  value,
}: ContactMethodRowProps) => {
  const record = getRecordDef(method.key)

  return (
    <div className="flex w-full items-start gap-3 pt-1">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          className={cn(
            'flex h-11 min-w-0 items-center gap-2.5 rounded-sm border border-[#d4d4d4] px-4',
            errorMessage && 'border-red-600',
          )}
        >
          <IconRenderer
            className="size-3 shrink-0 text-ens-quartz-900"
            icon={record?.icon}
          />
          <input
            aria-invalid={Boolean(errorMessage)}
            aria-label={method.label}
            className="min-w-0 flex-1 bg-transparent text-[14px] leading-[1.2] outline-none placeholder:text-ens-quartz-400 disabled:pointer-events-none md:text-[16px]"
            disabled={disabled}
            onChange={(event) => onValueChange(method, event.target.value)}
            placeholder={method.placeholder}
            type={'type' in method ? method.type : 'text'}
            value={value}
          />
        </label>
        {errorMessage ? (
          <p className={contactErrorMessageClassName} role="alert">
            <MSymbol
              aria-hidden="true"
              className={contactErrorMessageIconClassName}
              symbol={contactErrorMessageIconSymbol}
            />
            <span>{errorMessage}</span>
          </p>
        ) : null}
        {noticeMessage ? (
          <p className="flex items-start gap-1 text-ens-signal-warning-700 text-xs leading-[1.2]">
            <MSymbol
              aria-hidden="true"
              className="ms-opsz-12 ms-wght-400 mt-px shrink-0"
              symbol="info"
            />
            <span>{noticeMessage}</span>
          </p>
        ) : null}
      </div>
      <PrimaryContactButton
        disabled={disabled || primaryDisabled}
        label={method.label}
        onClick={() => onPrimaryChange(method, !primary)}
        selected={primary}
      />
    </div>
  )
}
