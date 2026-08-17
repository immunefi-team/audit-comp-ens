import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, CircleCheck, Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { Address } from 'viem'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { CopyButton } from '@/components/CopyButton'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { prepareSetAliasTransaction } from '@/features/resolver/helpers/setAlias'
import {
  getResolverOverviewQueryOptions,
  type ResolverNode,
} from '@/features/resolver/hooks/useResolverOverview'
import { useSetAlias } from '@/features/resolver/hooks/useSetAlias'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { sepoliaWithEns } from '@/lib/wagmi'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/resolver/$address/create-alias')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) => {
    return queryClient.prefetchQuery(
      getResolverOverviewQueryOptions({
        address: params.address as Address,
      }),
    )
  },
})

interface PageHeaderProps {
  readonly address: string
}

const PageHeader = ({ address }: PageHeaderProps) => (
  <div className="flex flex-col gap-2">
    <Link to="/resolver/$address/aliases" params={{ address }}>
      <Button
        variant="ghost"
        className="flex items-center gap-1 -ml-2 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-6" />
        Back
      </Button>
    </Link>
    <h1 className="text-h1">Create alias</h1>
  </div>
)

interface NodeOptionProps {
  readonly node: ResolverNode
}

const NodeOption = ({ node }: NodeOptionProps) => (
  <div className="flex items-center gap-3">
    <NameAvatar
      name={node.name}
      width="28px"
      height="28px"
      rounded="rounded-sm"
    />
    <span className="font-mono text-sm">{node.name}</span>
    <CopyButton value={node.name} />
  </div>
)

const CREATE_ALIAS_TX_ID = 'tx-create-alias'

function RouteComponent() {
  const { address } = Route.useParams()
  const navigate = useNavigate()
  const { address: accountAddress, isConnected } = useConnection()
  const chainId = sepoliaWithEns.id
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [fromName, setFromName] = useState<string | null>(null)
  const [toName, setToName] = useState<string | null>(null)
  const [pendingAlias, setPendingAlias] = useState<{
    readonly fromName: string
    readonly toName: string
  } | null>(null)
  const { openModal, closeModal, clearTransaction } = useTransactionModal()

  const {
    data: resolver,
    isLoading,
    error,
  } = useQuery(getResolverOverviewQueryOptions({ address: address as Address }))

  const { data: hasSetAliasRole } = useQuery({
    ...getHasRolesQueryOptions({
      resolverAddress: address as Address,
      roles: ['ROLE_SET_ALIAS'],
      account: accountAddress as Address,
    }),
    enabled: !!accountAddress,
  })

  const canSetAlias = Boolean(hasSetAliasRole)

  const nodes = resolver?.nodes ?? []
  const existingAliases = resolver?.aliases ?? []

  const nameOptions = nodes.map((n) => n.name)
  const nodeOptions = nodes
    .filter((n) => n.name !== fromName)
    .map((n) => n.name)

  const selectedFromNode = fromName
    ? (nodes.find((n) => n.name === fromName) ?? null)
    : null

  const selectedToNode = toName
    ? (nodes.find((n) => n.name === toName) ?? null)
    : null

  const isAlreadyAliased = fromName
    ? existingAliases.some((a) => a.fromName === fromName)
    : false

  const mutation = useSetAlias({
    resolverAddress: address as Address,
    walletClient,
    publicClient,
    chainId,
    id: CREATE_ALIAS_TX_ID,
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!fromName || !toName) return
    mutation.reset()
    setPendingAlias({ fromName, toName })
    openModal()
  }

  if (isLoading) return <LoadingMessage />
  if (error)
    return (
      <ErrorMessage
        title="Failed to load resolver"
        description={error.cause?.message}
      />
    )

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-160 mx-auto">
        <PageHeader address={address} />
        <p className="text-muted-foreground">
          This resolver has no nodes. A node must exist before an alias can be
          created.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-160 mx-auto">
      <PageHeader address={address} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Field data-invalid={isAlreadyAliased}>
          <FieldLabel>Name</FieldLabel>
          <Combobox
            value={fromName}
            onValueChange={(val) => {
              setFromName(val)
              if (val === toName) setToName(null)
            }}
          >
            <ComboboxInput placeholder="Select a name..." />
            <ComboboxContent>
              <ComboboxList>
                {nameOptions.map((name) => (
                  <ComboboxItem key={name} value={name}>
                    <NodeOption
                      node={nodes.find((n) => n.name === name) as ResolverNode}
                    />
                  </ComboboxItem>
                ))}
                <ComboboxEmpty>No names found</ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {selectedFromNode && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-sm">
              <NameAvatar
                name={selectedFromNode.name}
                width="40px"
                height="40px"
                rounded="rounded-sm"
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {selectedFromNode.name}
                  </span>
                  <CopyButton value={selectedFromNode.name} />
                </div>
                {selectedFromNode.owner?.id && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {selectedFromNode.owner.id}
                    </span>
                    <CopyButton value={selectedFromNode.owner.id} />
                  </div>
                )}
              </div>
            </div>
          )}
          {isAlreadyAliased && (
            <p className="text-sm text-danger">
              {fromName} already has an alias. Creating a new one will overwrite
              the existing alias.
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel>Node to use</FieldLabel>
          <Combobox value={toName} onValueChange={setToName}>
            <ComboboxInput
              placeholder="Select a node..."
              disabled={!fromName}
            />
            <ComboboxContent>
              <ComboboxList>
                {nodeOptions.map((name) => (
                  <ComboboxItem key={name} value={name}>
                    <NodeOption
                      node={nodes.find((n) => n.name === name) as ResolverNode}
                    />
                  </ComboboxItem>
                ))}
                <ComboboxEmpty>No nodes available</ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {selectedToNode && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-sm">
              <NameAvatar
                name={selectedToNode.name}
                width="40px"
                height="40px"
                rounded="rounded-sm"
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {selectedToNode.name}
                  </span>
                  <CopyButton value={selectedToNode.name} />
                </div>
                {selectedToNode.owner?.id && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {selectedToNode.owner.id}
                    </span>
                    <CopyButton value={selectedToNode.owner.id} />
                  </div>
                )}
              </div>
            </div>
          )}
        </Field>

        {!isConnected && (
          <p className="text-sm text-warning">
            Please connect your wallet to create an alias.
          </p>
        )}
        {isConnected && canSetAlias === false && (
          <p className="text-sm text-danger">
            Your account does not have the ROLE_SET_ALIAS permission on this
            resolver.
          </p>
        )}
        {mutation.error && (
          <p className="text-sm text-danger">{mutation.error.message}</p>
        )}

        <Button
          type="submit"
          disabled={
            !fromName ||
            !toName ||
            mutation.isPending ||
            !walletClient ||
            !isConnected ||
            !canSetAlias
          }
          className="w-full sm:w-fit"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <CircleCheck className="size-4" />
              Create alias
            </>
          )}
        </Button>
      </form>
      <TransactionModal
        transactions={[
          {
            id: CREATE_ALIAS_TX_ID,
            title: 'Create alias',
            transactionName: `Alias ${pendingAlias?.fromName ?? ''} -> ${pendingAlias?.toName ?? ''}`,
            intent: {
              prepare: pendingAlias
                ? ({ walletClient, chainId }) =>
                    prepareSetAliasTransaction({
                      fromName: pendingAlias.fromName,
                      toName: pendingAlias.toName,
                      resolverAddress: address as Address,
                      walletClient,
                      chainId,
                    })
                : undefined,
            },
            onStart: () => {
              if (!pendingAlias) return
              mutation.mutate(pendingAlias)
            },
            onDone: () => {
              closeModal()
              clearTransaction()
              setPendingAlias(null)
              navigate({
                to: '/resolver/$address/aliases',
                params: { address },
              })
            },
          },
        ]}
      />
    </div>
  )
}
