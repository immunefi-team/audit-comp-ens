import {
  Domain_OrderBy,
  type DomainsQuery,
  OrderDirection,
} from '@ens-apps/indexer'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import type { Address, PublicClient } from 'viem'
import { getAddress, isAddressEqual } from 'viem'
import { useChainId, useConnection } from 'wagmi'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ResolverSetupConfirmDialog } from '@/features/profile/components/dialogs/ResolverSetupConfirmDialog'
import { useSetPrimaryName } from '@/features/profile/hooks/useSetPrimaryName'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import { getProfileEthAddressSnapshot } from '@/features/profile/service/profileEthAddress'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { saveRecords } from '@/features/profile/service/profileRecordTransactions'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { resolverWriteAccessQuery } from '@/features/profile/service/resolverWriteAccess'
import { setupControlledResolver } from '@/features/profile/service/setupControlledResolver'
import {
  type SmartAccountContextValue,
  useSmartAccountContext,
} from '@/lib/smart-account'
import { publicClient } from '@/lib/wagmi'
import { getDomainsQuery } from '../service/queries/getDashboardDomains'
import { resolveDomainLabel } from '../utils'
import {
  getEthAddressFromRecords,
  hasMatchingEthAddress,
} from './ChoosePrimaryNameDialog.handlers'

interface ChoosePrimaryNameDialogProps {
  readonly onUpdated?: () => void
  readonly children?: React.ReactNode
}

type PrimaryNameDomain = DomainsQuery['domains'][number]
type PrimaryNameQueryVariables = Parameters<typeof getDomainsQuery>[0]
type SelectedNameRecords = Parameters<typeof getEthAddressFromRecords>[0]

const PrimaryNameSkeletonList = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 3 }, (_, i) => `skeleton-${i}`).map((skeletonId) => (
      <div className="flex items-center gap-3 rounded-sm p-3" key={skeletonId}>
        <div className="size-8.5 shrink-0 animate-pulse rounded-sm bg-gray-200" />
        <div className="h-5 w-37.5 animate-pulse rounded bg-gray-200" />
      </div>
    ))}
  </div>
)

const PrimaryNameOption = ({
  domain,
  selectedName,
  isSubmitting,
  onSelectName,
}: {
  readonly domain: PrimaryNameDomain
  readonly selectedName: string | null
  readonly isSubmitting: boolean
  readonly onSelectName: (name: string) => void
}) => {
  const { t } = useLingui()
  const label = resolveDomainLabel(domain)
  const isSelected = selectedName === label
  const avatarUrl = buildNameAvatarUrl(label)

  return (
    <button
      aria-label={t`Select ${label} as primary name`}
      aria-pressed={isSelected}
      className={`flex items-center justify-between gap-3 rounded-sm border p-3 transition-colors ${
        isSelected
          ? 'border-ens-blue bg-ens-lapis-dust'
          : 'border-ens-gray-two hover:border-ens-blue/50 hover:bg-ens-white'
      } ${isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      disabled={isSubmitting}
      key={domain.id}
      onClick={() => onSelectName(label)}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="relative size-8.5 shrink-0 overflow-hidden rounded-sm bg-ens-white">
          <ImageFallback.Root className="contents">
            <ImageFallback.Image
              alt={t`${label} avatar`}
              className="size-full object-cover"
              src={avatarUrl}
            />
            <ImageFallback.Fallback>
              <PatternAvatar
                className="size-full rounded-sm border-none bg-transparent p-0 shadow-none"
                name={label}
              />
            </ImageFallback.Fallback>
          </ImageFallback.Root>
        </div>
        <span className="font-mono text-[16px] text-foreground leading-[0.96] tracking-[-0.32px]">
          {label}
        </span>
      </div>
      {isSelected && (
        <Check className="size-5 shrink-0 text-ens-blue" strokeWidth={2.5} />
      )}
    </button>
  )
}

/**
 * The connected wallet can't write to the name's resolver — either it has no
 * resolver (reset during transfer) or the resolver belongs to a previous owner.
 * Surfaced from the write path as a fallback; the pre-flight normally catches
 * this first and routes the flow through the resolver-setup path instead.
 */
class ResolverNotControlledError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Wallet cannot write to this name’s resolver', options)
    this.name = 'ResolverNotControlledError'
  }
}

/** Label for the confirm button, reflecting the current step of the flow. */
const ConfirmButtonLabel = ({
  settingUpResolver,
  settingEthAddress,
  isSubmitting,
}: {
  readonly settingUpResolver: boolean
  readonly settingEthAddress: boolean
  readonly isSubmitting: boolean
}) => {
  const { t } = useLingui()

  return match({
    settingUpResolver,
    settingEthAddress,
    isSubmitting,
  })
    .with({ settingUpResolver: true }, () => <>{t`Updating profile...`}</>)
    .with({ settingEthAddress: true }, () => <>{t`Updating address...`}</>)
    .with({ isSubmitting: true }, () => <>{t`Setting...`}</>)
    .otherwise(() => <>{t`Set as Primary`}</>)
}

/** Renders a plain error message for any failure in the set-primary flow. */
const PrimaryNameErrorNotice = ({
  errorMessage,
}: {
  readonly errorMessage: string | undefined
}) => {
  if (!errorMessage) return null

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  )
}

const useUpdateEthAddressMutation = ({
  account,
  chainId,
  selectedName,
  selectedNameRecords,
}: {
  readonly account: SmartAccountContextValue
  readonly chainId: number
  readonly selectedName: string | null
  readonly selectedNameRecords: SelectedNameRecords
}) => {
  const { t } = useLingui()

  return useMutation({
    mutationFn: async () => {
      if (!selectedName || !account.ownerAddress) return

      const walletAddress = account.ownerAddress as Address

      // Writing a record on an existing resolver is an owner-EOA transaction,
      // not an HCA intent — the resolver authorizes the owner wallet, and the
      // session validator's action policy rejects the same call as an intent.
      // Require the wallet still bound to the owner: `resolverWriteAccess`
      // probed from that address, so a mid-switch wallet would revert on-chain.
      const { walletClient } = account
      if (
        !walletClient?.account ||
        !isAddressEqual(walletClient.account.address, walletAddress)
      ) {
        return
      }

      const snapshot = await getProfileEthAddressSnapshot(
        selectedName,
        selectedNameRecords?.resolverAddress as Address | undefined,
      )

      if (snapshot.isErr()) {
        const name = selectedName
        throw new Error(t`Couldn’t read the wallet address for ${name}`)
      }

      const { resolverAddress, ethAddress } = snapshot.value

      if (!resolverAddress) {
        throw new ResolverNotControlledError()
      }

      if (ethAddress?.toLowerCase() === walletAddress.toLowerCase()) return

      await saveRecords({
        name: selectedName,
        before: {
          texts: [],
          coins: ethAddress ? [{ coinType: 60, value: ethAddress }] : [],
        },
        after: {
          texts: [],
          coins: [{ coinType: 60, value: getAddress(walletAddress) }],
        },
        signer: { type: 'eoa', walletClient },
        accountAddress: walletClient.account.address,
        publicClient: publicClient as PublicClient,
        chainId,
        resolverAddress,
      })
    },
    onError: (error) => {
      console.error('Failed to set ETH address record:', error)
    },
  })
}

/**
 * Set up a resolver this wallet can write to, then seed the ETH address.
 * One sponsored intent; runs before set-primary when write access is missing.
 */
const useSetupResolverMutation = ({
  account,
  chainId,
  selectedName,
}: {
  readonly account: SmartAccountContextValue
  readonly chainId: number
  readonly selectedName: string | null
}) => {
  const { t } = useLingui()

  return useMutation({
    mutationFn: async () => {
      const { signer } = account
      if (!selectedName || !account.ownerAddress) return

      if (signer?.type !== 'rhinestone') {
        throw new Error(t`Please finish connecting your wallet, then try again`)
      }

      const walletAddress = account.ownerAddress as Address

      await setupControlledResolver({
        name: selectedName,
        signer,
        ownerAddress: walletAddress,
        publicClient: publicClient as PublicClient,
        chainId,
        before: { texts: [], coins: [] },
        after: {
          texts: [],
          coins: [{ coinType: 60, value: getAddress(walletAddress) }],
        },
      })
    },
    onError: (error) => {
      console.error('Failed to set up resolver for primary name:', error)
    },
  })
}

const shouldUpdateEthAddress = ({
  selectedName,
  isLoadingRecords,
  selectedNameRecords,
  ownerAddress,
}: {
  readonly selectedName: string | null
  readonly isLoadingRecords: boolean
  readonly selectedNameRecords: SelectedNameRecords
  readonly ownerAddress?: string
}) =>
  Boolean(selectedName) &&
  !isLoadingRecords &&
  !hasMatchingEthAddress(selectedNameRecords, ownerAddress)

const getPrimaryNameQueryVariables = (
  address: string | undefined,
): PrimaryNameQueryVariables => {
  const normalizedAddress = address?.toLowerCase()
  if (!normalizedAddress) return undefined

  return {
    where: { owner: normalizedAddress },
    first: 100,
    skip: 0,
    orderBy: Domain_OrderBy.Name,
    orderDirection: OrderDirection.Asc,
  }
}

export const ChoosePrimaryNameDialog = ({
  onUpdated,
  children,
}: ChoosePrimaryNameDialogProps) => {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false)
  const { address } = useConnection()
  const account = useSmartAccountContext()
  const queryClient = useQueryClient()
  const chainId = useChainId()

  const {
    submit: submitPrimaryName,
    isSubmitting,
    isError,
    error: primaryNameError,
  } = useSetPrimaryName({
    onSuccess: () => {
      toast.success(t`Primary name set successfully`)
      queryClient.invalidateQueries({
        queryKey: $qk({ $scope: 'profile', $action: 'reverse_name' }),
      })
      queryClient.invalidateQueries({
        queryKey: $qk({ $scope: 'profile', $action: 'resolver_write_access' }),
      })
      queryClient.invalidateQueries({
        queryKey: $qk({ $scope: 'profile', $action: 'get_records' }),
      })
      setOpen(false)
      onUpdated?.()
    },
  })

  const primaryNameErrorMessage =
    (isError && (primaryNameError?.message || t`Failed to set primary name`)) ||
    undefined

  // Fetch current primary name from reverse resolver
  const { data: reverseName } = useQuery({
    ...profileReverseNameQuery(account.ownerAddress ?? undefined),
    enabled: open && !!account.ownerAddress,
  })

  // Fetch all owned names
  const queryVariables = getPrimaryNameQueryVariables(address)

  const { data: domainsData, isLoading } = useQuery(
    getDomainsQuery(open ? queryVariables : undefined),
  )
  const allDomains = domainsData?.domains ?? []

  // Sort domains to always show primary name first
  const domains = useMemo(
    () =>
      [...allDomains].sort((a, b) => {
        const labelA = resolveDomainLabel(a)
        const labelB = resolveDomainLabel(b)
        const isPrimaryA = labelA.toLowerCase() === reverseName?.toLowerCase()
        const isPrimaryB = labelB.toLowerCase() === reverseName?.toLowerCase()

        if (isPrimaryA) return -1
        if (isPrimaryB) return 1
        return 0
      }),
    [allDomains, reverseName],
  )

  const { data: selectedNameRecords, isLoading: isLoadingRecords } = useQuery({
    ...profileRecordsQuery(selectedName ?? ''),
    enabled: open && !!selectedName,
  })
  const existingEthAddress = getEthAddressFromRecords(selectedNameRecords)
  const needsEthAddressUpdate = shouldUpdateEthAddress({
    selectedName,
    isLoadingRecords,
    selectedNameRecords,
    ownerAddress: account.ownerAddress ?? undefined,
  })
  const updateEthAddressMutation = useUpdateEthAddressMutation({
    account,
    chainId,
    selectedName,
    selectedNameRecords,
  })
  const setupResolverMutation = useSetupResolverMutation({
    account,
    chainId,
    selectedName,
  })

  // Probe whether this wallet can write to the selected name's resolver.
  const resolverWriteAccess = useQuery({
    ...resolverWriteAccessQuery(
      selectedName ?? undefined,
      (account.ownerAddress as Address | null) ?? undefined,
    ),
    enabled: open && Boolean(selectedName) && Boolean(account.ownerAddress),
  })

  // No write access → confirm, then set up a controlled resolver before primary.
  const resolverBlocked = resolverWriteAccess.data === false
  const resolverAccessPending =
    Boolean(selectedName) &&
    Boolean(account.ownerAddress) &&
    resolverWriteAccess.isLoading

  // Set selected name to current primary on mount
  useEffect(() => {
    if (reverseName && !selectedName) {
      setSelectedName(reverseName)
    }
  }, [reverseName, selectedName])

  const handleSelectName = (name: string) => {
    if (!isSubmitting) {
      updateEthAddressMutation.reset()
      setupResolverMutation.reset()
      setSelectedName(name)
    }
  }

  const runConfirm = async () => {
    if (!selectedName || !account.ownerAddress) return

    if (!account.signer || !account.accountAddress) {
      toast.error(t`Wallet isn’t ready yet. Try again in a moment.`)
      return
    }

    try {
      if (resolverBlocked) {
        await setupResolverMutation.mutateAsync()
      } else if (needsEthAddressUpdate) {
        await updateEthAddressMutation.mutateAsync()
      }
    } catch {
      return
    }

    try {
      await submitPrimaryName({
        name: selectedName,
        owner: account.ownerAddress as Address,
      })
    } catch {
      // Error surfaced via isError / primaryNameErrorMessage.
    }
  }

  const handleConfirm = () => {
    if (!selectedName || !account.ownerAddress) return

    if (!account.signer || !account.accountAddress) {
      toast.error(t`Wallet isn’t ready yet. Try again in a moment.`)
      return
    }

    if (resolverBlocked) {
      setSetupConfirmOpen(true)
      return
    }

    void runConfirm()
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setOpen(false)
      setSelectedName(reverseName ?? null)
    }
  }

  const hasChanges = selectedName !== reverseName

  const showEthAddressInfo = needsEthAddressUpdate && !resolverBlocked
  const isPreparing =
    updateEthAddressMutation.isPending || setupResolverMutation.isPending
  const confirmDisabled =
    isSubmitting ||
    isPreparing ||
    resolverAccessPending ||
    !hasChanges ||
    !selectedName
  const actionErrorMessage =
    setupResolverMutation.error?.message ??
    updateEthAddressMutation.error?.message ??
    primaryNameErrorMessage

  return (
    <>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="flex max-h-[90vh] max-w-125 flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-[24px] text-foreground">
              <Trans>Choose Primary Name</Trans>
            </DialogTitle>
            <DialogDescription className="font-sans text-muted-foreground text-sm">
              <Trans>
                Set which ENS name displays as your identity across apps and
                wallets.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
            {/* Names List */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {match({ isLoading, domains })
                .with({ isLoading: true }, () => <PrimaryNameSkeletonList />)
                .with({ domains: [] }, () => (
                  <div className="py-8 text-center font-sans text-muted-foreground text-sm">
                    <Trans>No names found</Trans>
                  </div>
                ))
                .otherwise(({ domains }) =>
                  domains.map((domain) => (
                    <PrimaryNameOption
                      domain={domain}
                      isSubmitting={isSubmitting}
                      key={domain.id}
                      onSelectName={handleSelectName}
                      selectedName={selectedName}
                    />
                  )),
                )}
            </div>

            {/* Error Message */}
            <PrimaryNameErrorNotice errorMessage={actionErrorMessage} />
            {/* ETH Address Mismatch/Missing Info */}
            {showEthAddressInfo && account.ownerAddress && (
              <Alert variant="warning">
                <AlertCircle />
                <AlertDescription>
                  <p>
                    {existingEthAddress
                      ? t`This name points to a different wallet. If you continue, we’ll update it to your current wallet and set this name as your primary.`
                      : t`This name doesn’t have a wallet address yet. If you continue, we’ll set it to your current wallet and make this name your primary.`}
                  </p>
                  <div className="mt-2 w-full rounded-md bg-amber-100/60 px-2.5 py-1.5">
                    <p className="break-all font-mono text-amber-900 text-xs">
                      {account.ownerAddress}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {/* Action Buttons */}
            <div className="flex shrink-0 gap-3">
              <Button
                className="h-12 flex-1 rounded-xs border-ens-white bg-ens-white font-mono text-ens-blue text-sm uppercase tracking-wider transition-colors hover:bg-ens-white/80 disabled:border-border disabled:bg-ens-white disabled:text-muted-foreground"
                disabled={isSubmitting || isPreparing}
                onClick={handleCancel}
                variant="outline"
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                className="h-12 flex-1 rounded-xs border-ens-blue bg-ens-blue font-mono text-sm text-white uppercase tracking-wider transition-colors hover:bg-ens-blue-hover disabled:border-border disabled:bg-ens-white disabled:text-muted-foreground"
                disabled={confirmDisabled}
                onClick={handleConfirm}
              >
                <ConfirmButtonLabel
                  isSubmitting={isSubmitting}
                  settingEthAddress={updateEthAddressMutation.isPending}
                  settingUpResolver={setupResolverMutation.isPending}
                />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ResolverSetupConfirmDialog
        intent="primary-name"
        onConfirm={() => {
          void runConfirm()
        }}
        onOpenChange={setSetupConfirmOpen}
        open={setupConfirmOpen}
      />
    </>
  )
}
