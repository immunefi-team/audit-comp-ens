import { getRegistrarAddress } from '@ens-apps/l2-primary/v1'
import { defaultReverseRegistrarSetNameSnippet } from '@ensdomains/ensjs-abi/defaultReverseRegistrar'
import { reverseRegistrarSetNameSnippet } from '@ensdomains/ensjs-abi/reverseRegistrar'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Row } from '@tanstack/react-table'
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import {
  type FC,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from 'react'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import { type Address, isAddress, isAddressEqual } from 'viem'
import { useConnection } from 'wagmi'
import { CopyableRecord } from '@/components/CopyableRecord'
import { EntityBadge } from '@/components/EntityBadge'
import { InfoRow } from '@/components/InfoCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { RecentActivity } from '@/features/profile/components/RecentActivity'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { useCanEditRecords } from '@/features/records/hooks/useCanEditRecords'
import { useSaveRecords } from '@/features/records/hooks/useSaveRecords'
import { DEFAULT_REVERSE_REGISTRAR_ADDRESS } from '@/features/reverse-resolution/config'
import { useSetL2ReverseName } from '@/features/reverse-resolution/hooks/useSetL2ReverseName'
import { useSetReverseResolution } from '@/features/reverse-resolution/hooks/useSetReverseResolution'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { useIsMobile } from '@/hooks/use-mobile'
import { MAINNET_COIN_TYPE } from '@/lib/coinType'
import { names } from '@/lib/reverseRegistrarChainId'
import { cn, fromCoinType } from '@/lib/utils'
import { sepoliaWithEns } from '@/lib/wagmi'
import type { EditableRecord } from '@/utils/records/editRecordUtils'
import type { ProtocolVersion } from '@/utils/types'
import type { ReverseMatchStatus } from '../hooks/useReverseMatch'
import { L1_VERIFICATION_LAG_ESTIMATES } from './networks'
import type { AddressResolutionRow } from './types'

// The sidebar's history covers the name's resolution records only — address
// record writes and (v1) reverse-name changes — not transfers/registrations.
const ADDRESS_HISTORY_EVENT_TYPES = ['AddressChanged', 'NameChanged'] as const

const coinNetworkName = (coinType: number, fallback: string) => {
  try {
    return (
      (names as Record<number, string>)[fromCoinType(BigInt(coinType))] ??
      fallback
    )
  } catch {
    return fallback
  }
}

const Banner = ({
  status,
  label,
  lagEstimate,
  errorDetail,
  action,
}: {
  status: ReverseMatchStatus
  label: string
  lagEstimate?: string
  errorDetail?: string | null
  action?: ReactNode
}) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 p-4 rounded-md',
      match(status)
        .with('verified', () => 'bg-success-fill text-success-text')
        .with('pending', () => 'bg-accent-fill text-accent-text')
        .with('unverifiable', () => 'bg-danger-fill text-danger-text')
        .with('mismatch', () => 'bg-danger-fill text-danger-text')
        .exhaustive(),
    )}
  >
    <div className="flex items-center gap-3">
      {match(status)
        .with('verified', () => (
          <>
            <CheckCircle2 className="size-6 shrink-0" />
            <span className="font-medium">
              This is the primary name on {label}
            </span>
          </>
        ))
        .with('pending', () => (
          <>
            <Clock className="size-6 shrink-0" />
            <span className="text-sm">
              Primary name is set on {label} — waiting for L1 verification
              {lagEstimate ? ` (${lagEstimate})` : ''}.
            </span>
          </>
        ))
        .with('unverifiable', () => (
          <>
            <TriangleAlert className="size-6 shrink-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm">
                Can't verify reverse resolution on {label} right now
              </span>
              {errorDetail && (
                <code className="font-mono text-xs opacity-80 break-all">
                  {errorDetail}
                </code>
              )}
            </div>
          </>
        ))
        .with('mismatch', () => (
          <>
            <XCircle className="size-6 shrink-0" />
            <span className="text-sm">
              The set address does not resolve back to this name on {label}
            </span>
          </>
        ))
        .exhaustive()}
    </div>
    {action}
  </div>
)

const CoinTypeRow = ({
  coinType,
  icon,
  label,
}: {
  coinType: number
  icon: string
  label: string
}) => (
  <InfoRow label="Coin Type">
    <div className="flex items-center gap-2">
      {icon && <img src={icon} alt={label} className="w-5 h-5" />}
      <span>
        {coinType} {coinNetworkName(coinType, label)}
      </span>
    </div>
  </InfoRow>
)

const AddressField = ({
  address,
  canEdit,
  addressInput,
  setAddressInput,
  disabled,
  saveDisabled,
  saveLabel,
  onSave,
}: {
  address: string | null
  canEdit: boolean
  addressInput: string
  setAddressInput: (v: string) => void
  disabled: boolean
  saveDisabled: boolean
  saveLabel: string
  onSave: () => void
}) => (
  <InfoRow label="Address">
    <div className="flex-1 flex flex-col gap-2">
      {address ? (
        isAddress(address) ? (
          <EntityBadge variant="address" address={address} format="wrap">
            {address}
          </EntityBadge>
        ) : (
          <EntityBadge
            type="content"
            variant="default"
            format="wrap"
            copyValue={address}
          >
            {address}
          </EntityBadge>
        )
      ) : (
        <span className="font-mono text-sm text-muted-foreground/50">null</span>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <Input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x…"
            disabled={disabled}
            className="font-mono"
          />
          <Button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="h-9 shrink-0"
          >
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  </InfoRow>
)

const PrimaryNameRow = ({
  status,
  address,
  reverseName,
  icon,
  label,
}: {
  status: ReverseMatchStatus | null | undefined
  address: string | null
  reverseName: string | null | undefined
  icon: string
  label: string
}) => (
  <InfoRow label="Primary name">
    <div className="flex items-center gap-2 flex-wrap">
      <Badge
        variant="outline"
        className={cn(
          'text-xs border-transparent',
          match(status)
            .with('verified', () => 'bg-success-fill text-success-text')
            .with('pending', () => 'bg-accent-fill text-accent-text')
            .with('unverifiable', () => 'bg-default-fill text-default-text')
            .otherwise(() => 'bg-danger-fill text-danger-text'),
        )}
      >
        {match(status)
          .with('verified', () => <CheckCircle2 className="size-4" />)
          .with('pending', () => <Clock className="size-4" />)
          .with('unverifiable', () => <TriangleAlert className="size-4" />)
          .otherwise(() => (
            <XCircle className="size-4" />
          ))}
        <span>
          {match(status)
            .with('verified', () => 'True')
            .with('pending', () => 'Pending')
            .with('unverifiable', () => 'Unverifiable')
            .otherwise(() => 'False')}
        </span>
      </Badge>
      {address && (
        <div className="flex flex-row items-center gap-2">
          {reverseName ? (
            <div className="flex items-center gap-2">
              <NameAvatar name={reverseName} width="20px" height="20px" />
              <span>{reverseName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">null</span>
          )}
          <ArrowLeftRight className="size-4" />
          {icon && <img src={icon} alt={label} className="w-5 h-5" />}
          <CopyableRecord
            value={address}
            truncate
            displayValue={
              <span>
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            }
            className="font-mono text-sm"
          />
        </div>
      )}
    </div>
  </InfoRow>
)

const saveButtonLabel = (s: {
  isConnected: boolean
  isSwitchingChain: boolean
  isWrongChain: boolean
  isWriting: boolean
  isSyncing: boolean
}) =>
  match(s)
    .with({ isConnected: false }, () => 'Connect Wallet')
    .with({ isSwitchingChain: true }, () => 'Switching…')
    .with({ isWrongChain: true }, () => 'Switch Network')
    .with({ isWriting: true }, () => 'Saving…')
    .with({ isSyncing: true }, () => 'Syncing…')
    .otherwise(() => 'Save')

const ResolutionDetails = ({
  row,
  name,
  address,
  canEdit,
  addressInput,
  setAddressInput,
  isBusy,
  hasResolver,
  saveLabel,
  onSave,
  protocolVersion,
  canSetPrimaryName,
  isSettingPrimaryName,
  onSetPrimaryName,
}: {
  row: AddressResolutionRow
  name: string
  address: string | null
  canEdit: boolean
  addressInput: string
  setAddressInput: (v: string) => void
  isBusy: boolean
  hasResolver: boolean
  saveLabel: string
  onSave: () => void
  protocolVersion: ProtocolVersion | undefined
  canSetPrimaryName: boolean
  isSettingPrimaryName: boolean
  onSetPrimaryName: () => void
}) => {
  const { label, icon, coinType, reverseMatch, reverseName } = row
  // `null`/`undefined` = nothing to check / still loading — no banner.
  const status = reverseMatch ?? null
  const lagEstimate =
    row.l2ChainId != null
      ? L1_VERIFICATION_LAG_ESTIMATES[row.l2ChainId]
      : undefined
  // Setting the primary name only makes sense for a genuine mismatch:
  // `pending` means the write already landed on the L2 and just awaits proof,
  // and `unverifiable` means the L1 verification path is down — a new write
  // couldn't be verified either, so offering it would just mint another
  // unverifiable record.
  const offerSetPrimary = status === 'mismatch' && canSetPrimaryName

  return (
    <div className="p-6 flex flex-col gap-6 [&_[data-slot=info-row]]:px-0">
      <SheetHeader className="p-0">
        <SheetTitle className="font-sans text-h2">
          {label} resolution
        </SheetTitle>
      </SheetHeader>

      {address && status && (
        <Banner
          status={status}
          label={label}
          lagEstimate={lagEstimate}
          errorDetail={row.reverseError}
          action={
            offerSetPrimary ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary font-medium shrink-0"
                disabled={isSettingPrimaryName}
                onClick={onSetPrimaryName}
              >
                {isSettingPrimaryName ? 'Setting…' : 'Set primary name'}
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-6">
        <CoinTypeRow coinType={coinType} icon={icon} label={label} />
        <AddressField
          address={address}
          canEdit={canEdit}
          addressInput={addressInput}
          setAddressInput={setAddressInput}
          disabled={isBusy}
          saveDisabled={!addressInput || isBusy || !hasResolver}
          saveLabel={saveLabel}
          onSave={onSave}
        />
        <PrimaryNameRow
          status={status}
          address={address}
          reverseName={reverseName}
          icon={icon}
          label={label}
        />
        {protocolVersion && (
          <div className="border-t pt-6">
            <RecentActivity
              name={name}
              protocolVersion={protocolVersion}
              eventTypes={ADDRESS_HISTORY_EVENT_TYPES}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const SET_PRIMARY_TX_ID = 'tx-forward-set-primary-name'

/**
 * Owns the two write flows for the selected network — editing the
 * `addr(coinType)` record, and (when permitted) setting the primary name so the
 * address resolves back to this name. Both share the one transaction modal,
 * switched by `activeFlow`.
 */
const useAddressRecordEditor = (
  name: string,
  data: AddressResolutionRow | null,
  resolverAddress: Address | undefined,
) => {
  const { address: connectedAddress, isConnected } = useConnection()
  const { data: owner } = useQuery(getEnsOwnerQueryOptions({ name }))
  const queryClient = useQueryClient()
  const { openModal, closeModal, clearTransaction } = useTransactionModal()
  const {
    saveRecords,
    isWriting,
    isConfirming,
    isSyncing,
    isWrongChain,
    isSwitchingChain,
    switchToRequiredNetwork,
  } = useSaveRecords()

  // "Set primary name" sets the reverse record that actually controls the
  // selected row via `setName(string)` (which sets `msg.sender`'s own record):
  //   - Default row (0x80000000) → ENSv1 `DefaultReverseRegistrar` (default.reverse)
  //   - Mainnet row (coin 60)    → ENSv1 `ReverseRegistrar` (addr.reverse)
  //   - L2 rows                  → that chain's L2 reverse registrar
  // Per-row routing matters because a chain-specific record shadows
  // `default.reverse` (ENSIP-19) — a default write could succeed on-chain
  // while leaving the selected row unresolved.
  // Offered only when the connected wallet *is* this address (setName is
  // msg.sender-scoped).
  const canSetPrimaryName =
    !!connectedAddress &&
    !!data?.address &&
    isAddress(data.address, { strict: false }) &&
    isAddressEqual(connectedAddress, data.address)

  const { setReverseResolution } = useSetReverseResolution({
    chainId: sepoliaWithEns.id,
    id: SET_PRIMARY_TX_ID,
  })
  const { setL2ReverseNameAsync, isPending: isSettingL2PrimaryName } =
    useSetL2ReverseName()
  const [activeFlow, setActiveFlow] = useState<'addr' | 'primary'>('addr')

  // The address input is fully derived — no state writes during render and no
  // effect needed: an edit applies only to the row (coin type) it was typed
  // on, so switching rows implicitly falls back to that row's current address.
  // When the record is unset, fall back to the connected wallet so editors
  // setting their own address don't have to copy-paste it. The edit UI only
  // renders for accounts that can write records, so others never see this default.
  const [edit, setEdit] = useState<{ coinType: number; value: string } | null>(
    null,
  )
  const addressInput =
    edit && edit.coinType === data?.coinType
      ? edit.value
      : (data?.address ?? connectedAddress ?? '')
  const setAddressInput = (value: string) => {
    if (data) setEdit({ coinType: data.coinType, value })
  }

  const { canEdit } = useCanEditRecords({
    name,
    roles: ['ROLE_SET_ADDR'],
  })

  const txId = data ? `tx-set-addr-${data.coinType}` : 'tx-set-addr'
  const onTransactionDone = () => {
    closeModal()
    clearTransaction()
  }
  const onPrimaryNameDone = () => {
    // The resolved addresses didn't change — only the reverse record did — so
    // the reverse-match query key is unchanged and won't refetch on its own.
    // Invalidate it so the banner / primary-name row reflect the new state.
    queryClient.invalidateQueries({ queryKey: ['get-reverse-matches'] })
    onTransactionDone()
  }

  const startSetAddr = () => {
    if (!resolverAddress || !data) return
    const record: EditableRecord = {
      type: 'address',
      key: data.label,
      value: addressInput,
      id: data.coinType,
    }
    saveRecords({
      name,
      resolverAddress,
      // Setting a single coin record is idempotent — an empty original set
      // plus one new coin resolves to `setAddr(coinType, value)`.
      originalRecords: [],
      pendingChanges: {
        newRecords: [record],
        editedValues: new Map(),
        deletedIds: new Set(),
      },
      id: txId,
    })
  }

  const startSetPrimaryName = () => {
    // Only the two L1 rows reach this transaction-modal flow (L2 rows go
    // through `setL2PrimaryName` below). Mainnet (coin 60) writes
    // `addr.reverse` via the ENSv1 `ReverseRegistrar`; the Default row writes
    // `default.reverse`. Both are `setName(string)` on Sepolia L1.
    if (data?.coinType === MAINNET_COIN_TYPE) {
      const registrarAddress = getRegistrarAddress(60, 'sepolia')
      if (!registrarAddress) return
      setReverseResolution({
        name,
        request: {
          address: registrarAddress,
          abi: reverseRegistrarSetNameSnippet,
          functionName: 'setName',
          args: [name],
        },
      })
      return
    }
    setReverseResolution({
      name,
      request: {
        address: DEFAULT_REVERSE_REGISTRAR_ADDRESS,
        abi: defaultReverseRegistrarSetNameSnippet,
        functionName: 'setName',
        args: [name],
      },
    })
  }

  // L2 rows write `setName` on that chain's reverse registrar through the
  // isolated `l2WagmiConfig` (connection re-attach + chain switch handled by
  // the hook), mirroring the reverse-view sidebar — so no transaction modal,
  // toasts instead.
  const setL2PrimaryName = async (row: AddressResolutionRow) => {
    if (row.l2ChainId == null) return
    const toastId = toast.loading(`Setting primary name on ${row.label}…`)
    try {
      await setL2ReverseNameAsync({
        name,
        reverseRegistrarChainId: row.l2ChainId,
      })
      queryClient.invalidateQueries({ queryKey: ['get-reverse-matches'] })
      toast.success(`${name} set as the primary name on ${row.label}`, {
        id: toastId,
        // The reverse-match check resolves through the L1 UniversalResolver,
        // which can only see L2 state whose root has been proven to L1. The
        // write itself is confirmed on the L2 instantly, but this page's
        // verified badge lags by the chain's state-root cadence (roughly:
        // Scroll ~1–2h, Linea ~4h, Arbitrum ~7.6h, OP up to days on Sepolia).
        description:
          'Confirmed on the L2. Verified resolution here can take a while to update — the L2 state must first be proven to L1.',
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to set primary name',
        { id: toastId },
      )
    }
  }

  const openFlow = (flow: 'addr' | 'primary') => {
    if (isWrongChain) return switchToRequiredNetwork()
    setActiveFlow(flow)
    openModal()
  }

  const transactions =
    activeFlow === 'primary'
      ? [
          {
            id: SET_PRIMARY_TX_ID,
            title: 'Set primary name',
            transactionName: `Set ${name} as the primary name`,
            estimatedGasCost: 0.0001,
            onStart: startSetPrimaryName,
            onDone: onPrimaryNameDone,
          },
        ]
      : [
          {
            id: txId,
            title: 'Set address',
            transactionName: `Set ${data?.label ?? ''} address for ${name}`,
            estimatedGasCost: 0.0001,
            onStart: startSetAddr,
            onDone: onTransactionDone,
          },
        ]

  return {
    canEdit,
    canSetPrimaryName,
    protocolVersion: owner?.protocolVersion,
    hasResolver: !!resolverAddress,
    addressInput,
    setAddressInput,
    isBusy: isWriting || isConfirming || isSyncing || isSwitchingChain,
    saveLabel: saveButtonLabel({
      isConnected,
      isSwitchingChain,
      isWrongChain,
      isWriting: isWriting || isConfirming,
      isSyncing,
    }),
    onSave: () => {
      if (!addressInput || !resolverAddress) return
      openFlow('addr')
    },
    isSettingPrimaryName: isSettingL2PrimaryName,
    onSetPrimaryName: () => {
      if (data?.l2ChainId != null) {
        void setL2PrimaryName(data)
        return
      }
      openFlow('primary')
    },
    transactions,
  }
}

/**
 * Sheet for a single network's forward resolution. Editing writes the
 * `addr(coinType)` record for accounts with resolver write permission.
 *
 * `TransactionModal` is a sibling of `SheetContent` (never nested inside it),
 * mirroring `ReverseResolutionSidebar`.
 */
export const AddressResolutionSidebar: FC<
  PropsWithChildren<{
    row: Row<AddressResolutionRow> | null
    name: string
    resolverAddress: Address | undefined
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  }>
> = ({ children, row, name, resolverAddress, open, setOpen }) => {
  const isMobile = useIsMobile()
  const data = row?.original ?? null
  const editor = useAddressRecordEditor(name, data, resolverAddress)

  return (
    <Sheet open={open} onOpenChange={setOpen} defaultOpen={false}>
      {children}
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="bg-background p-0"
      >
        <div className="h-full overflow-y-auto">
          {data ? (
            <ResolutionDetails
              row={data}
              name={name}
              address={data.address}
              canEdit={editor.canEdit}
              addressInput={editor.addressInput}
              setAddressInput={editor.setAddressInput}
              isBusy={editor.isBusy}
              hasResolver={editor.hasResolver}
              saveLabel={editor.saveLabel}
              onSave={editor.onSave}
              protocolVersion={editor.protocolVersion}
              canSetPrimaryName={editor.canSetPrimaryName}
              isSettingPrimaryName={editor.isSettingPrimaryName}
              onSetPrimaryName={editor.onSetPrimaryName}
            />
          ) : (
            <div className="p-6 text-muted-foreground text-center py-12">
              No resolution selected
            </div>
          )}
        </div>
      </SheetContent>
      <TransactionModal transactions={editor.transactions} />
    </Sheet>
  )
}
