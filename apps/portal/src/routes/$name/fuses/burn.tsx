import { ChildFuseKeys, type DecodedFuses } from '@ensdomains/ensjs/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ShieldX,
} from 'lucide-react'
import { useState } from 'react'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageCard } from '@/components/ui/message-card'
import {
  burnFuses,
  prepareBurnFusesTransaction,
} from '@/features/fuses/helpers/burnFuses'
import { isFuseBurnt } from '@/features/fuses/utils/isFuseBurnt'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { getWrapperDataQueryOptions } from '@/features/resolver/hooks/useWrapperData'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useActiveTransactionState } from '@/features/transaction-manager/hooks/useActiveTransactionState'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { sepoliaWithEns } from '@/lib/wagmi'

export const Route = createFileRoute('/$name/fuses/burn')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

type ChildFuseKey = (typeof ChildFuseKeys)[number]

const BURN_FUSES_TX_ID = 'tx-burn-fuses'

const childFuseDisplayNames: Record<ChildFuseKey, string> = {
  CANNOT_UNWRAP: 'Cannot Unwrap',
  CANNOT_BURN_FUSES: 'Cannot Burn Fuses',
  CANNOT_TRANSFER: 'Cannot Transfer',
  CANNOT_SET_RESOLVER: 'Cannot Set Resolver',
  CANNOT_SET_TTL: 'Cannot Set TTL',
  CANNOT_CREATE_SUBDOMAIN: 'Cannot Create Subname',
  CANNOT_APPROVE: 'Cannot Approve',
}

function RouteComponent() {
  const { name } = Route.useParams()
  const { address } = useConnection()
  const queryClient = useQueryClient()
  const chainId = sepoliaWithEns.id

  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const wrapperDataQuery = useQuery({
    ...getWrapperDataQueryOptions({ name }),
  })

  const [selectedChildFuses, setSelectedChildFuses] = useState<
    Set<ChildFuseKey>
  >(new Set())

  const {
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction: clearTransactionModal,
  } = useTransactionModal()
  const txState = useActiveTransactionState()

  if (wrapperDataQuery.isLoading) {
    return <LoadingMessage />
  }

  if (wrapperDataQuery.error) {
    return (
      <ErrorMessage
        title="Failed to load fuses"
        description={wrapperDataQuery.error.cause?.message}
      />
    )
  }

  const wrapperData = wrapperDataQuery.data

  if (!wrapperData) {
    return <V2NameMessage />
  }

  const isOwner = address && wrapperData.owner === address

  if (!isOwner) {
    return <NotOwnerMessage />
  }

  const fuses = wrapperData.fuses as DecodedFuses | undefined
  const expiry = wrapperData.expiry

  const isParentFuseBurnt = (fuseKey: string): boolean =>
    isFuseBurnt(fuseKey, 'Parent', fuses)

  const isChildFuseBurnt = (fuseKey: ChildFuseKey): boolean =>
    isFuseBurnt(fuseKey, 'Owner', fuses)

  const isPCCBurnt = isParentFuseBurnt('PARENT_CANNOT_CONTROL')
  const isCannotUnwrapBurnt = isChildFuseBurnt('CANNOT_UNWRAP')
  const isCannotBurnFusesBurnt = isChildFuseBurnt('CANNOT_BURN_FUSES')
  const isCannotUnwrapSelected = selectedChildFuses.has('CANNOT_UNWRAP')

  const canSelectChildFuse = (fuseKey: ChildFuseKey): boolean => {
    if (isCannotBurnFusesBurnt) return false
    if (isChildFuseBurnt(fuseKey)) return false
    if (fuseKey === 'CANNOT_UNWRAP') {
      return isPCCBurnt
    }
    return isCannotUnwrapBurnt || isCannotUnwrapSelected
  }

  const toggleChildFuse = (fuseKey: ChildFuseKey) => {
    if (!canSelectChildFuse(fuseKey)) return
    const newSelected = new Set(selectedChildFuses)
    if (newSelected.has(fuseKey)) {
      newSelected.delete(fuseKey)
      if (fuseKey === 'CANNOT_UNWRAP' && !isCannotUnwrapBurnt) {
        for (const key of ChildFuseKeys) {
          if (key !== 'CANNOT_UNWRAP') newSelected.delete(key)
        }
      }
    } else {
      newSelected.add(fuseKey)
    }
    setSelectedChildFuses(newSelected)
  }

  const handleBurn = () => {
    if (selectedChildFuses.size === 0) return
    if (!walletClient || !publicClient) return
    openTransactionModal()
  }

  const handleStartTransaction = async () => {
    if (!walletClient || !publicClient) return

    const signer = createEOASigner(walletClient)
    const childFusesArray = Array.from(selectedChildFuses)

    try {
      await burnFuses({
        name,
        fuses: childFusesArray,
        walletClient,
        publicClient,
        signer,
        chainId,
        id: BURN_FUSES_TX_ID,
      })
    } catch (err) {
      console.error('Failed to burn fuses:', err)
    }
  }

  const hasChanges = selectedChildFuses.size > 0
  const isPending =
    txState?.machineState === 'submitting' ||
    txState?.machineState === 'pending' ||
    txState?.machineState === 'confirming'

  return (
    <>
      <div className="flex flex-col items-center w-full">
        <div className="flex flex-col gap-6 max-w-2xl w-full">
          <Link
            to="/$name/fuses"
            params={{ name }}
            className="flex items-center gap-1 text-muted-foreground hover:text-muted-foreground text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <h1 className="text-h1">Burn fuses</h1>

          <div className="bg-muted rounded-sm p-6 flex gap-4 items-start">
            <AlertTriangle className="w-8 h-8 shrink-0" />
            <p className="text-foreground">
              Burning fuses will make permanent changes to your name.
              <br />
              You will not be able to undo these changes, and they will only be
              reset if the name expires.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-medium">Fuse expiry</span>
            <div className="flex items-center h-10 px-2 border border-border rounded bg-background">
              <span className="flex-1 text-sm">
                {expiry
                  ? new Date(Number(expiry) * 1000).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short',
                    })
                  : 'N/A'}
              </span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-medium">Fuses</span>
            <div className="flex flex-col gap-2">
              {ChildFuseKeys.map((fuseKey) => {
                const burnt = isChildFuseBurnt(fuseKey)
                const canSelect = canSelectChildFuse(fuseKey)
                const isSelected = selectedChildFuses.has(fuseKey)

                return (
                  <div key={fuseKey} className="flex gap-2 items-center">
                    <Checkbox
                      checked={isSelected || burnt}
                      disabled={!canSelect}
                      onCheckedChange={() => toggleChildFuse(fuseKey)}
                    />
                    <span
                      className={
                        !canSelect || burnt
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      }
                    >
                      {childFuseDisplayNames[fuseKey]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <Button
            variant="default"
            onClick={handleBurn}
            disabled={
              !hasChanges || !address || !walletClient || isCannotBurnFusesBurnt
            }
            className="flex items-center justify-center gap-2 h-10 w-fit"
          >
            <CheckCircle className="w-5 h-5" />
            {isPending ? 'Burning fuses...' : 'Save changes'}
          </Button>

          {!address && (
            <p className="text-muted-foreground text-sm">
              Connect your wallet to burn fuses
            </p>
          )}
        </div>
      </div>

      <TransactionModal
        transactions={[
          {
            id: BURN_FUSES_TX_ID,
            title: 'Burn Fuses',
            transactionName: `Permanently burn selected fuses on ${name}`,
            // Deterministic from the selected fuses, so the modal can estimate
            // gas the moment it opens (shared with the burnFuses submit path).
            intent: {
              prepare:
                selectedChildFuses.size > 0
                  ? ({ walletClient, chainId }) =>
                      prepareBurnFusesTransaction({
                        name,
                        fuses: Array.from(selectedChildFuses),
                        walletClient,
                        chainId,
                      })
                  : undefined,
            },
            onStart: handleStartTransaction,
            onDone: () => {
              queryClient.invalidateQueries({
                queryKey: ['get-wrapper-data'],
              })
              setSelectedChildFuses(new Set())
              closeTransactionModal()
              clearTransactionModal()
            },
          },
        ]}
      />
    </>
  )
}

const V2NameMessage = () => (
  <MessageCard
    icon={<AlertTriangle className="size-6" />}
    title="Fuses not available"
    description={
      <>
        <p>Fuses are not available for ENSv2 names.</p>
        <p className="text-quartz-900/60 text-sm mt-2">
          Only ENSv1 names have fuses.
        </p>
      </>
    }
  />
)

const NotOwnerMessage = () => (
  <MessageCard
    icon={<ShieldX className="size-6" />}
    title="Not authorized"
    description={
      <>
        <p>You are not the owner of this name.</p>
        <p className="text-quartz-900/60 text-sm mt-2">
          Only the owner can burn fuses on this name.
        </p>
      </>
    }
  />
)
