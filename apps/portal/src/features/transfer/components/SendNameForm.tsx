import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { match, P } from 'ts-pattern'
import { type Address, isAddressEqual, zeroAddress } from 'viem'
import { CopyableRecord } from '@/components/CopyableRecord'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { AddressNameInput } from '@/features/address/components/AddressNameInput'
import { useAddressResolution } from '@/features/address/hooks/useAddressResolution'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getPrimaryNameQueryOptions } from '@/features/profile/hooks/usePrimaryName'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransferDetachTargets } from '../hooks/useTransferDetachTargets'
import { useTransferName } from '../hooks/useTransferName'
import type { TransferOptions } from '../utils/buildTransferPlan'

type SendNameFormProps = {
  readonly name: string
  readonly registryAddress: Address
  readonly owner: Address
}

type OptionKey = 'setEthAddress' | 'detachResolver' | 'detachRegistry'

type OptionConfig = {
  readonly key: OptionKey
  readonly label: string
  readonly description: string
  /** Shown right below the toggle when it's turned off. */
  readonly warning: string
}

const OPTIONS: readonly OptionConfig[] = [
  {
    key: 'setEthAddress',
    label: 'Set the ETH address to the recipient',
    description:
      'Points this name’s ETH address record at the recipient, so it can no longer resolve to you.',
    warning:
      'This name’s ETH address will keep pointing to you after the transfer, so you could re-set it as your primary name. Turn this on to point it at the recipient instead.',
  },
  {
    key: 'detachResolver',
    label: 'Detach the resolver',
    description:
      'Detaches this name’s resolver so it stops resolving to your records entirely. The recipient starts clean and sets up their own.',
    warning:
      'This name’s other records will keep resolving after the transfer. Until the recipient updates them, it could still be listed as the primary name for an address that no longer controls it.',
  },
  {
    key: 'detachRegistry',
    label: 'Detach the registry',
    description:
      'Detaches this name’s registry so its subnames stop resolving. The recipient starts clean.',
    warning:
      'You’ll keep control of this name’s subnames after transfer — the name will keep pointing at your registry.',
  },
]

export const SendNameForm = ({
  name,
  registryAddress,
  owner,
}: SendNameFormProps) => {
  const [recipientInput, setRecipientInput] = useState('')
  const [options, setOptions] = useState<Record<OptionKey, boolean>>({
    setEthAddress: true,
    detachResolver: true,
    detachRegistry: true,
  })

  const {
    optionIsVisible,
    settled: detachTargetsSettled,
    failed: detachTargetsFailed,
  } = useTransferDetachTargets({ name, registryAddress, owner })

  const resolution = useAddressResolution(recipientInput)
  const { address: recipient, isResolving } = resolution

  const { startTransfer, transactions, isPreparing, prepError } =
    useTransferName({ name, registryAddress, owner })

  const isSelf = !!recipient && isAddressEqual(recipient, owner)
  const isZeroAddress = !!recipient && isAddressEqual(recipient, zeroAddress)
  const hasValidRecipient = !!recipient && !isSelf && !isZeroAddress

  // A hidden option never contributes to the plan, whatever its stored value.
  const effectiveOptions: TransferOptions = {
    setEthAddress: options.setEthAddress && optionIsVisible.setEthAddress,
    detachResolver: options.detachResolver && optionIsVisible.detachResolver,
    detachRegistry: options.detachRegistry && optionIsVisible.detachRegistry,
  }

  const visibleOptions = OPTIONS.filter((option) => optionIsVisible[option.key])

  const canStart =
    hasValidRecipient && !isResolving && !isPreparing && detachTargetsSettled

  const toggleOption = (key: OptionKey) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }))

  const runTransfer = () => {
    if (!recipient || !canStart) return
    startTransfer({ recipient, options: effectiveOptions })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl w-full">
      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Transferring ownership of an ENS name is irreversible. Make sure you
          check the recipient address before proceeding.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-1">
        <span className="font-medium">Recipient</span>
        <AddressNameInput
          value={recipientInput}
          onChange={setRecipientInput}
          resolution={resolution}
          className="h-9"
          resolvedContent={
            <RecipientResolvedContent
              recipient={recipient}
              isSelf={isSelf}
              isZeroAddress={isZeroAddress}
            />
          }
        />
      </div>

      {hasValidRecipient && (
        <TransferDetachOptions
          options={options}
          visibleOptions={visibleOptions}
          onToggle={toggleOption}
        />
      )}

      <Button
        variant="default"
        onClick={runTransfer}
        disabled={!canStart}
        className="flex items-center justify-center gap-2 w-fit"
      >
        {isPreparing ? 'Preparing…' : 'Transfer name'}
      </Button>

      {hasValidRecipient && detachTargetsFailed && (
        <span className="text-destructive text-sm">
          Couldn’t check this name’s current resolver and registry. Refresh and
          try again before transferring.
        </span>
      )}

      {prepError && (
        <span className="text-destructive text-sm">{prepError.message}</span>
      )}

      <TransactionModal transactions={transactions} />
    </div>
  )
}

const TransferDetachOptions = ({
  options,
  visibleOptions,
  onToggle,
}: {
  readonly options: Record<OptionKey, boolean>
  readonly visibleOptions: readonly OptionConfig[]
  readonly onToggle: (key: OptionKey) => void
}) => {
  if (visibleOptions.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {visibleOptions.map((option) => {
        const disabled =
          option.key === 'setEthAddress' && options.detachResolver

        return (
          <div key={option.key} className="flex flex-col gap-2">
            <label
              htmlFor={`transfer-option-${option.key}`}
              className={`flex items-start justify-between gap-3 ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <span className="flex flex-col">
                <span className="text-foreground font-medium">
                  {option.label}
                </span>
                <span className="text-muted-foreground text-sm">
                  {disabled
                    ? 'Not needed while the resolver is being detached.'
                    : option.description}
                </span>
              </span>
              <Switch
                id={`transfer-option-${option.key}`}
                checked={options[option.key]}
                onCheckedChange={() => onToggle(option.key)}
                disabled={disabled}
                className="mt-1 shrink-0"
              />
            </label>

            {!disabled && !options[option.key] && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertDescription>{option.warning}</AlertDescription>
              </Alert>
            )}
          </div>
        )
      })}
    </div>
  )
}

const RecipientResolvedContent = ({
  recipient,
  isSelf,
  isZeroAddress,
}: {
  readonly recipient: Address | null
  readonly isSelf: boolean
  readonly isZeroAddress: boolean
}) =>
  match({ recipient, isSelf, isZeroAddress })
    .with({ isSelf: true }, () => (
      <p className="text-sm mt-1.5 text-destructive">
        The recipient already owns this name.
      </p>
    ))
    .with({ isZeroAddress: true }, () => (
      <p className="text-sm mt-1.5 text-destructive">
        Can’t transfer to the zero address.
      </p>
    ))
    .with({ recipient: P.nonNullable }, ({ recipient }) => (
      <RecipientPreview address={recipient} />
    ))
    .otherwise(() => null)

const RecipientPreview = ({ address }: { address: Address }) => {
  const { data: primaryName, isLoading } = useQuery(
    getPrimaryNameQueryOptions(address),
  )

  return (
    <div className="flex bg-muted items-center gap-3 rounded-sm p-2.5">
      {isLoading ? (
        <Skeleton className="size-12 rounded-sm shrink-0" />
      ) : (
        <NameAvatar
          name={primaryName ?? address}
          width="48px"
          height="48px"
          rounded="rounded-sm"
        />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        {match(primaryName)
          .with(P.string.minLength(1), (value) => (
            <CopyableRecord value={value} textClassName="text-foreground" />
          ))
          .otherwise(() => null)}
        <CopyableRecord
          value={address}
          displayValue={address}
          textClassName="text-muted-foreground sm:text-xs"
          truncate={false}
        />
      </div>
    </div>
  )
}
