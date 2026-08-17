import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { fromPromise } from 'neverthrow'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type Address, zeroAddress } from 'viem'
import { useAccount } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { MessageCard } from '@/components/ui/message-card'
import {
  type SubnameRow,
  SubnamesTable,
} from '@/features/names/components/SubnamesTable'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { getSubnamesQueryOptions } from '@/features/profile/hooks/useSubnames'
import { useDeleteSubname } from '@/features/registry/hooks/useDeleteSubname'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { prepareDeleteSubnameTransaction } from '@/features/registry/utils/delete-subname.helpers'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import type {
  IntentContext,
  Transaction,
} from '@/features/transaction-manager/types'
import { isRegistrable } from '@/utils/ens/tldHelpers'

const DELETE_SUBNAME_TX_ID_PREFIX = 'tx-delete-ens-subname'
const deleteTxId = (subnameName: string) =>
  `${DELETE_SUBNAME_TX_ID_PREFIX}-${subnameName}`

export const Route = createFileRoute('/$name/subnames')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

interface NoSubregistryMessageProps {
  readonly name: string
  readonly canDeploy: boolean
}

const NoSubregistryMessage = ({
  name,
  canDeploy,
}: NoSubregistryMessageProps) => (
  <MessageCard
    variant="warning"
    icon={<AlertCircle size={24} strokeWidth={1.5} />}
    title="No subregistry"
    description={
      <p>
        This name does not have a subregistry.
        <br />
        {canDeploy
          ? 'You must deploy one to create subnames.'
          : 'You do not have permission to deploy one.'}
      </p>
    }
    actionButton={
      canDeploy
        ? {
            label: 'Deploy subregistry',
            href: `/${encodeURIComponent(name)}/registry`,
          }
        : undefined
    }
  />
)

interface V2SubnamesContentProps {
  readonly name: string
}

const V2SubnamesContent = ({ name }: V2SubnamesContentProps) => {
  const { address: connectedAccount } = useAccount()

  const {
    data: registriesData,
    isLoading: registriesLoading,
    error: registriesError,
  } = useQuery(getNameRegistriesQueryOptions({ name }))

  // The subregistry is always the first element (index 0) in the registries array
  // For 2LD "foo.eth": [subregistry, ethRegistry, root]
  // For 3LD "sub.foo.eth": [subregistry, fooRegistry, ethRegistry, root]
  // For 4LD "x.sub.foo.eth": [subregistry, subRegistry, fooRegistry, ethRegistry, root]
  const subregistryAddress = registriesData?.[0]
  const hasSubregistry =
    subregistryAddress && subregistryAddress !== zeroAddress

  // Check if connected account has ROLE_REGISTRAR on the subregistry ROOT resource
  const { data: hasRegistrarRole } = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: subregistryAddress as Address,
      label: '',
      roles: ['ROLE_REGISTRAR'],
      account: connectedAccount as Address,
    }),
    enabled: Boolean(hasSubregistry) && Boolean(connectedAccount),
  })

  // Check if connected account has ROLE_UNREGISTER on the subregistry ROOT resource
  const { data: hasUnregisterRole } = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: subregistryAddress as Address,
      label: '',
      roles: ['ROLE_UNREGISTER'],
      account: connectedAccount as Address,
    }),
    enabled: Boolean(hasSubregistry) && Boolean(connectedAccount),
  })

  // Check if connected account can deploy a subregistry (ROLE_SET_SUBREGISTRY on parent registry)
  const parentRegistryAddress = registriesData?.[1]
  const firstLabel = name.split('.')[0]
  const { data: hasSetSubregistryRole } = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: parentRegistryAddress as Address,
      label: firstLabel,
      roles: ['ROLE_SET_SUBREGISTRY'],
      account: connectedAccount as Address,
    }),
    enabled:
      Boolean(parentRegistryAddress) &&
      Boolean(connectedAccount) &&
      !hasSubregistry,
  })

  const {
    data: subnames,
    isLoading: subnamesLoading,
    error: subnamesError,
  } = useQuery({
    ...getSubnamesQueryOptions({ name, protocolVersion: 'ENSv2' }),
    enabled: Boolean(hasSubregistry),
  })

  const {
    deleteSubnameAsync,
    isDeleting,
    error: deleteError,
  } = useDeleteSubname({
    name,
    registryAddress: (subregistryAddress as Address) ?? zeroAddress,
  })

  const {
    isOpen: isTransactionModalOpen,
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction,
  } = useTransactionModal()

  // Subnames queued for the current modal session. Length 1 for single delete
  // (inline confirm), N for bulk Clear. The modal walks through them in order.
  const [queuedDeletes, setQueuedDeletes] = useState<readonly SubnameRow[]>([])
  // Names whose delete tx is in flight — used to dim the row in the table.
  // A Set keeps adds idempotent (bulk Clear pre-marks every selected name
  // before runDelete fires, and runDelete also self-marks).
  const [pendingNames, setPendingNames] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  // Names whose delete tx already succeeded — hidden from the UI immediately
  // so the user sees the result before the indexer catches up. Cleared
  // automatically once the refreshed query no longer returns them.
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<
    ReadonlySet<string>
  >(() => new Set())

  /**
   * Extract the first label from a full subname.
   * e.g. "cold.domico.eth" → "cold"
   */
  const getLabel = useCallback(
    (subname: string) => {
      const suffix = `.${name}`
      if (subname.endsWith(suffix)) {
        return subname.slice(0, -suffix.length)
      }
      return subname.split('.')[0]
    },
    [name],
  )

  // Tracks names whose deleteSubnameAsync mutation is currently in flight.
  // Prevents double-submission when both the modal's auto-advance onDone
  // and the user's "Open wallet" click attempt to fire the same tx for the
  // same subname — the second runDelete call is a no-op until the first
  // settles.
  const inFlightRef = useRef<Set<string>>(new Set())

  const runDelete = useCallback(
    async (subname: SubnameRow, id: string) => {
      if (inFlightRef.current.has(subname.name)) return
      inFlightRef.current.add(subname.name)

      setPendingNames((prev) => {
        if (prev.has(subname.name)) return prev
        const next = new Set(prev)
        next.add(subname.name)
        return next
      })

      const result = await fromPromise(
        deleteSubnameAsync({
          subname: subname.name,
          label: getLabel(subname.name),
          id,
        }),
        (error) => error as Error,
      )

      setPendingNames((prev) => {
        if (!prev.has(subname.name)) return prev
        const next = new Set(prev)
        next.delete(subname.name)
        return next
      })
      if (result.isOk()) {
        setOptimisticallyDeleted((prev) => {
          const next = new Set(prev)
          next.add(subname.name)
          return next
        })
      }
      inFlightRef.current.delete(subname.name)
    },
    [deleteSubnameAsync, getLabel],
  )

  const queueForDeletion = useCallback(
    (rows: readonly SubnameRow[]) => {
      if (rows.length === 0) return
      setQueuedDeletes(rows)
      // Pre-mark every queued name as pending so all rows dim immediately,
      // not just the one currently being signed. runDelete pops each name
      // off as its tx settles; the close-cleanup effect handles abandons.
      setPendingNames((prev) => {
        const next = new Set(prev)
        for (const r of rows) next.add(r.name)
        return next
      })
      openTransactionModal()
    },
    [openTransactionModal],
  )

  const handleDeleteSubname = (subname: SubnameRow) =>
    queueForDeletion([subname])

  const handleClearSelected = (selected: SubnameRow[]) =>
    queueForDeletion(selected)

  // The prepared delete transaction for a queued subname — deterministic given
  // the registry and label, so the modal can estimate gas the moment it opens.
  // Matches the call submitted by runDelete → useDeleteSubname (same registry,
  // label and chainId) so the estimate stays byte-identical. Yields a lazy thunk
  // (or undefined when there's no subregistry) the modal calls with the ready
  // wallet context.
  const getDeleteIntent = (subname: SubnameRow) =>
    hasSubregistry && subregistryAddress
      ? ({ walletClient, chainId }: IntentContext) =>
          prepareDeleteSubnameTransaction({
            registryAddress: subregistryAddress,
            label: getLabel(subname.name),
            walletClient,
            chainId,
          })
      : undefined

  // One Transaction entry per queued subname. The modal walks through them
  // top-to-bottom; intermediate onDone fires the next one's onStart so the
  // user gets sequential wallet popups without having to click "Next" between
  // each. Last onDone wraps up the modal session.
  const deleteTransactions: readonly Transaction[] = queuedDeletes.map(
    (subname, i) => {
      const id = deleteTxId(subname.name)
      const isLast = i === queuedDeletes.length - 1
      const next = queuedDeletes[i + 1]
      return {
        id,
        title: 'Delete subname',
        transactionName: `Delete ${subname.name}`,
        intent: { prepare: getDeleteIntent(subname) },
        onStart: () => {
          void runDelete(subname, id)
        },
        onDone: isLast
          ? () => {
              closeTransactionModal()
              clearTransaction()
              setQueuedDeletes([])
            }
          : () => {
              void runDelete(next, deleteTxId(next.name))
            },
      }
    },
  )

  // When the modal closes (success path or user dismissal), reset the queue
  // and drop any pre-marked names that haven't actually started — runDelete
  // is the source of truth for in-flight names, and it manages its own entry.
  useEffect(() => {
    if (isTransactionModalOpen) return
    if (queuedDeletes.length === 0) return
    const queuedNames = new Set(queuedDeletes.map((r) => r.name))
    setQueuedDeletes([])
    setPendingNames((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const n of queuedNames) {
        if (next.delete(n)) changed = true
      }
      return changed ? next : prev
    })
  }, [isTransactionModalOpen, queuedDeletes])

  // Once the indexer has caught up and stopped returning a name we
  // optimistically deleted, drop it from the set — the row is naturally
  // absent from the query data, so the local override is no longer needed.
  useEffect(() => {
    if (!subnames) return
    const present = new Set(subnames.map((s) => s.name || ''))
    setOptimisticallyDeleted((prev) => {
      const next = new Set<string>()
      for (const n of prev) if (present.has(n)) next.add(n)
      return next.size === prev.size ? prev : next
    })
  }, [subnames])

  if (registriesLoading) {
    return <LoadingMessage title="Checking registry..." />
  }

  if (registriesError) {
    return (
      <ErrorMessage
        title="Failed to load registry"
        description={registriesError.cause?.message || registriesError.message}
      />
    )
  }

  if (!hasSubregistry) {
    return (
      <NoSubregistryMessage
        name={name}
        canDeploy={Boolean(hasSetSubregistryRole)}
      />
    )
  }

  if (subnamesLoading) {
    return <LoadingMessage title="Loading subnames..." />
  }

  if (subnamesError) {
    return (
      <ErrorMessage
        title="Failed to load subnames"
        description={subnamesError.cause?.message || subnamesError.message}
      />
    )
  }

  const canDeleteSubname = Boolean(hasUnregisterRole)

  const subnameRows: SubnameRow[] = (subnames || [])
    .filter((subname) => !optimisticallyDeleted.has(subname.name || ''))
    .map((subname) => ({
      name: subname.name || '',
      owner: subname.owner,
      canDelete: canDeleteSubname,
    }))

  const canCreateSubname = Boolean(hasRegistrarRole)

  return (
    <>
      <SubnamesTable
        subnames={subnameRows}
        name={name}
        canCreateSubname={canCreateSubname}
        onDeleteSubname={canDeleteSubname ? handleDeleteSubname : undefined}
        onClearSelected={canDeleteSubname ? handleClearSelected : undefined}
        isDeleting={isDeleting}
        pendingNames={pendingNames}
      />
      {deleteError && (
        <ErrorMessage
          title="Failed to delete subname"
          description={deleteError.message}
        />
      )}
      {deleteTransactions.length > 0 && (
        <TransactionModal transactions={deleteTransactions} />
      )}
    </>
  )
}

interface V1SubnamesContentProps {
  readonly name: string
}

const V1SubnamesContent = ({ name }: V1SubnamesContentProps) => {
  const {
    data: subnames,
    isLoading,
    error,
  } = useQuery(getSubnamesQueryOptions({ name, protocolVersion: 'ENSv1' }))

  if (isLoading) return <LoadingMessage title="Loading subnames..." />

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load subnames"
        description={error.cause?.message || error.message}
      />
    )
  }

  const subnameRows: SubnameRow[] = (subnames || []).map((subname) => ({
    name: subname.name || '',
    owner: subname.owner,
  }))

  return <SubnamesTable subnames={subnameRows} name={name} />
}

function RouteComponent() {
  const { name } = Route.useParams()

  const {
    data: ownerData,
    isLoading,
    error,
  } = useQuery(getEnsOwnerQueryOptions({ name }))

  // The v2 registry keeps returning the previous owner (latestOwner) after
  // expiry, so registration is read from the registrar's availability (true
  // only past grace) rather than owner presence.
  const availabilityQuery = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })

  if (error) {
    return (
      <ErrorMessage
        title="Failed to fetch name data"
        description={error.cause.message}
      />
    )
  }

  if (isLoading || (availabilityQuery.isLoading && isRegistrable(name))) {
    return <LoadingMessage title="Loading name data..." />
  }

  if (availabilityQuery.error) {
    return (
      <ErrorMessage
        title="Error checking availability"
        description={
          availabilityQuery.error.cause?.message ||
          availabilityQuery.error.message
        }
      />
    )
  }

  if (availabilityQuery.data?.isAvailable || !ownerData) {
    return (
      <NotFoundMessage
        title="Name not registered"
        description={
          <>
            <strong>{name}</strong> is not registered, so there are no subnames
            to display.
          </>
        }
      />
    )
  }

  // V1 names - show their subnames
  if (ownerData.protocolVersion === 'ENSv1') {
    return <V1SubnamesContent name={name} />
  }

  // V2 names
  return <V2SubnamesContent name={name} />
}
