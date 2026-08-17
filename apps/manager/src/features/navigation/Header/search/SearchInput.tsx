import { useLingui } from '@lingui/react/macro'
import { Loader2Icon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { MSymbol } from '@/components/ui/material-symbol'
import { tw } from '@/utils/tailwind'

type SearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> &
  React.RefAttributes<HTMLInputElement> & {
    readonly searchValue: string
    readonly setSearchValue: (value: string) => void
    readonly isLoading?: boolean
    readonly onClear?: () => void
    readonly alwaysShowClear?: boolean
    wrapperProps?: React.ComponentPropsWithRef<'div'>
  }

export const SearchInput = ({
  searchValue,
  setSearchValue,
  isLoading = false,
  onClear,
  className,
  wrapperProps,
  alwaysShowClear = false,
  ...props
}: SearchInputProps) => {
  const { t } = useLingui()

  return (
    <InputGroup
      className={tw(
        'h-full rounded-md border-ens-gray-two bg-white md:rounded-sm',
        className,
      )}
      {...wrapperProps}
    >
      <InputGroupAddon>
        <MSymbol className="ms-opsz-24 text-[#4B4B4B]" symbol="search" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={t`Search for a name or address`}
        autoComplete="off"
        className="placeholder:text-[#8C8C8C]"
        onChange={(event) => setSearchValue(event.target.value)}
        placeholder={t`Search name, address...`}
        type="text"
        value={searchValue}
        {...props}
      />
      {isLoading ? (
        <InputGroupAddon align="inline-end">
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        </InputGroupAddon>
      ) : searchValue || alwaysShowClear ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={t`Clear search`}
            onClick={() => {
              setSearchValue('')
              onClear?.()
            }}
            size="icon-xs"
          >
            <MSymbol className="ms-opsz-24" symbol="close" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
