import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import { Input } from '@/components/ui/input'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import type { AddressResolution } from '../hooks/useAddressResolution'

type AddressNameInputProps = {
  /** Raw, untrimmed input value (controlled). */
  readonly value: string
  readonly onChange: (value: string) => void
  /** Resolution derived from `value` via `useAddressResolution`. */
  readonly resolution: AddressResolution
  /** Overrides the default "Resolved: 0x…" line once an address resolves. */
  readonly resolvedContent?: ReactNode
  readonly id?: string
  readonly name?: string
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly required?: boolean
  readonly className?: string
  readonly 'aria-label'?: string
}

/**
 * Standard "ENS name or address" text field: an `<Input>` plus a status line
 * with a distinct message per resolution state (invalid / resolving / resolved /
 * unresolved / error; nothing while empty). Owns no resolution logic — the
 * caller runs `useAddressResolution(value)` and passes the result in, so it can
 * gate its own submit button on `resolution.address` / `resolution.isResolving`.
 */
export const AddressNameInput = ({
  value,
  onChange,
  resolution,
  resolvedContent,
  className,
  placeholder = 'ENS name or address',
  ...inputProps
}: AddressNameInputProps) => {
  const { status, address, isRawAddress, isInvalid } = resolution

  return (
    <>
      <Input
        {...inputProps}
        value={value}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.currentTarget.value)}
        className={className}
      />
      {match(status)
        .with('resolving', () => (
          <p className="text-sm mt-1.5 text-muted-foreground">
            Resolving address…
          </p>
        ))
        .with('resolved', () => {
          if (resolvedContent !== undefined) return resolvedContent
          return address ? (
            <p className="text-sm mt-1.5 text-muted-foreground">
              {isRawAddress
                ? `Using address: ${truncateAddress(address, 6, 4)}`
                : `Resolved: ${truncateAddress(address, 6, 4)}`}
            </p>
          ) : null
        })
        .with('unresolved', () => (
          <p className="text-sm mt-1.5 text-danger">
            Could not resolve an address for “{value.trim()}”
          </p>
        ))
        .with('error', () => (
          <p className="text-sm mt-1.5 text-danger">
            Something went wrong resolving this address. Please try again.
          </p>
        ))
        .with('invalid', () => (
          <p className="text-sm mt-1.5 text-danger">
            Enter a valid ENS name or address
          </p>
        ))
        // No message before the user has typed anything.
        .with('empty', () => null)
        .exhaustive()}
    </>
  )
}
