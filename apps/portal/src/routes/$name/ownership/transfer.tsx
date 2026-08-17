import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ShieldX } from 'lucide-react'
import { match, P } from 'ts-pattern'
import { type Address, isAddressEqual } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { MessageCard } from '@/components/ui/message-card'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { SendNameForm } from '@/features/transfer/components/SendNameForm'
import { useCanTransferName } from '@/features/transfer/hooks/useCanTransferName'
import { is2LD } from '@/utils/ens/tldHelpers'

export const Route = createFileRoute('/$name/ownership/transfer')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { name } = Route.useParams()
  const { address } = useConnection()

  const isSubname = !is2LD(name)

  const ownerQuery = useQuery(getEnsOwnerQueryOptions({ name }))

  if (ownerQuery.isLoading) return <LoadingMessage />

  if (ownerQuery.error)
    return (
      <ErrorMessage
        title="Failed to load name"
        description={ownerQuery.error.cause.message}
      />
    )

  const data = ownerQuery.data

  return (
    <div className="flex flex-col items-center px-8 py-6 w-full">
      <div className="flex flex-col gap-6 max-w-2xl w-full">
        <Link
          to="/$name/ownership"
          params={{ name }}
          className="flex items-center gap-1 text-muted-foreground hover:text-muted-foreground text-sm font-medium"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className="text-3xl font-medium leading-tight">
          Transfer ownership
        </h1>

        {match({ data, address })
          .with(
            { data: P.nullish },
            { data: { protocolVersion: P.not('ENSv2') } },
            () => (
              <MessageCard
                icon={<AlertTriangle className="size-8" />}
                title="Transfer not available"
                description={
                  <p>Sending a name is only available for ENSv2 names.</p>
                }
              />
            ),
          )
          .with(
            { data: P.nonNullable },
            () => isSubname,
            () => (
              <MessageCard
                icon={<AlertTriangle className="size-8" />}
                title="Transfer not available"
                description={
                  <>
                    <p>
                      Transferring subnames isn’t supported yet. Sending a name
                      is currently available for first-class names, like{' '}
                      <span className="font-medium">name.eth</span>.
                    </p>
                    <p className="text-quartz-900/60 text-sm mt-2">
                      Subname transfer support is coming in a future update.
                    </p>
                  </>
                }
              />
            ),
          )
          .with({ address: P.nullish }, () => (
            <MessageCard
              icon={<ShieldX className="size-8" />}
              title="Connect your wallet"
              description={
                <p>Connect the wallet that owns this name to transfer it.</p>
              }
            />
          ))
          .with(
            { data: P.nonNullable, address: P.string },
            ({ data, address }) => isAddressEqual(address, data.owner),
            ({ data }) => (
              <AuthorizedTransfer
                name={name}
                registryAddress={data.registryAddress}
                owner={data.owner}
              />
            ),
          )
          .with({ data: P.nonNullable, address: P.string }, () => (
            <MessageCard
              icon={<ShieldX className="size-8" />}
              title="Not authorized"
              description={
                <>
                  <p>You are not the owner of this name.</p>
                  <p className="text-quartz-900/60 text-sm mt-2">
                    Only the current owner can transfer it.
                  </p>
                </>
              }
            />
          ))
          .exhaustive()}
      </div>
    </div>
  )
}

/**
 * The connected wallet owns the name — but token ownership alone doesn't
 * guarantee a transfer will succeed. The registry reverts unless the owner also
 * holds ROLE_CAN_TRANSFER_ADMIN, and the transfer flow runs irreversible detach
 * steps before the token moves. So confirm the role before offering the form;
 * otherwise show why the transfer isn't possible instead of walking the user
 * into a partial, unrecoverable failure.
 */
function AuthorizedTransfer({
  name,
  registryAddress,
  owner,
}: {
  readonly name: string
  readonly registryAddress: Address
  readonly owner: Address
}) {
  const { canTransfer, isLoading, isError } = useCanTransferName({
    name,
    registryAddress,
    account: owner,
  })

  if (isLoading) return <LoadingMessage />

  if (isError)
    return (
      <MessageCard
        icon={<AlertTriangle className="size-8" />}
        title="Couldn’t check transfer permission"
        description={
          <p>
            We couldn’t confirm whether this name can be transferred. Refresh
            and try again before starting a transfer.
          </p>
        }
      />
    )

  if (!canTransfer)
    return (
      <MessageCard
        icon={<ShieldX className="size-8" />}
        title="Transfer not available"
        description={
          <>
            <p>
              This wallet can’t transfer this name. Transferring requires a
              permission on the name’s token that this wallet doesn’t hold.
            </p>
            <p className="text-quartz-900/60 text-sm mt-2">
              This is common for subnames issued without transfer rights, or
              names whose transfer role was revoked or locked. Ask whoever
              issued the name to grant the transfer role
              (ROLE_CAN_TRANSFER_ADMIN), or transfer from the wallet that holds
              it.
            </p>
          </>
        }
      />
    )

  return (
    <SendNameForm name={name} registryAddress={registryAddress} owner={owner} />
  )
}
