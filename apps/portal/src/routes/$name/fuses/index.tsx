import {
  ChildFuseKeys,
  type DecodedFuses,
  FullParentFuseKeys,
} from '@ensdomains/ensjs/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownUp, Ban, Flame, Info } from 'lucide-react'
import { useConnection } from 'wagmi'
import { CopyableRecord } from '@/components/CopyableRecord'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCard } from '@/components/ui/message-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isFuseBurnt } from '@/features/fuses/utils/isFuseBurnt'
import { getWrapperDataQueryOptions } from '@/features/resolver/hooks/useWrapperData'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/$name/fuses/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

type FuseScope = 'Parent' | 'Owner'

type ParentFuseKey = (typeof FullParentFuseKeys)[number]
type ChildFuseKey = (typeof ChildFuseKeys)[number]
type FuseKey = ParentFuseKey | ChildFuseKey

interface FuseDefinition {
  name: string
  key: FuseKey
  scope: FuseScope
  description: string
}

// Map fuse keys to display names and descriptions
const parentFuseDisplayInfo: Record<
  ParentFuseKey,
  { name: string; description: string }
> = {
  PARENT_CANNOT_CONTROL: {
    name: 'Parent Cannot Control',
    description:
      'Allows a parent owner to emancipate a child name. After this is burned, the parent will no longer be able to burn any further fuses, and will no longer be able to replace/delete the child name. This fuse must be burned in order for any owner-controlled fuses to be burned on the name.',
  },
  IS_DOT_ETH: {
    name: 'Is Dot ETH',
    description:
      'This fuse cannot be burned by users of the Name Wrapper, it is only set internally when a .eth 2LD is wrapped.',
  },
  CAN_EXTEND_EXPIRY: {
    name: 'Can Extend Expiry',
    description:
      'The owner of the child name will be able to extend their own expiry. Normally, only the parent owner can extend the expiry of a child name.',
  },
}

const childFuseDisplayInfo: Record<
  ChildFuseKey,
  { name: string; description: string }
> = {
  CANNOT_UNWRAP: {
    name: 'Cannot Unwrap',
    description:
      'The name will be locked, and can no longer be unwrapped. This fuse must be burned in order for any other owner-controlled fuses to be burned on the name.',
  },
  CANNOT_BURN_FUSES: {
    name: 'Cannot Burn Fuses',
    description: 'No further fuses can be burned on the name.',
  },
  CANNOT_TRANSFER: {
    name: 'Cannot Transfer',
    description: 'The name (wrapped NFT) can no longer be transferred.',
  },
  CANNOT_SET_RESOLVER: {
    name: 'Cannot Set Resolver',
    description: 'The resolver contract for the name can no longer be updated.',
  },
  CANNOT_SET_TTL: {
    name: 'Cannot Set TTL',
    description: 'The TTL for the name can no longer be updated.',
  },
  CANNOT_CREATE_SUBDOMAIN: {
    name: 'Cannot Create Subname',
    description: 'New subdomains can no longer be created.',
  },
  CANNOT_APPROVE: {
    name: 'Cannot Approve',
    description:
      'The approved "subname renewal manager" for the name can no longer be updated.',
  },
}

// Build fuse definitions from ensjs keys
const fuseDefinitions: FuseDefinition[] = [
  ...FullParentFuseKeys.map((key) => ({
    key,
    scope: 'Parent' as const,
    ...parentFuseDisplayInfo[key],
  })),
  ...ChildFuseKeys.map((key) => ({
    key,
    scope: 'Owner' as const,
    ...childFuseDisplayInfo[key],
  })),
]

type FuseRow = FuseDefinition & { isBurnt: boolean }

function RouteComponent() {
  const { name } = Route.useParams()
  const { address } = useConnection()

  const wrapperDataQuery = useQuery({
    ...getWrapperDataQueryOptions({ name }),
  })

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

  const fuses = wrapperData.fuses as DecodedFuses | undefined
  const expiry = wrapperData.expiry
  const hasBurnedFuses =
    fuses?.parent &&
    Object.values(fuses.parent).some((v) => typeof v === 'boolean' && v)

  const data: FuseRow[] = fuseDefinitions.map((fuse) => ({
    ...fuse,
    isBurnt: isFuseBurnt(fuse.key, fuse.scope, fuses),
  }))

  const isOwner = address && wrapperData.owner === address

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-h1">Fuses</h1>
          {isOwner && (
            <Button asChild variant="default" className="gap-2">
              <Link to="/$name/fuses/burn" params={{ name }}>
                <Flame className="w-4 h-4 text-lapis-500" />
                Burn fuses
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 items-start max-w-3xl">
        <Info className="w-8 h-8 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground text-sm">
          A fuse is a permission or perk that can be granted/revoked on a name.
          As the name implies, once the fuse is "burned", it cannot be unburned.{' '}
          <a
            href="https://docs.ens.domains/wrapper/fuses"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline decoration-[10%] decoration-dotted"
          >
            Learn more about Fuses in the documentation
          </a>
          .
        </p>
      </div>

      {hasBurnedFuses && expiry && (
        <div className="border border-border rounded-sm p-6 flex gap-4 items-center">
          <p className="font-medium whitespace-nowrap">Fuse expiry</p>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm truncate">
              {new Date(Number(expiry) * 1000).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short',
              })}
            </span>
            <CopyableRecord value={expiry.toString()} />
          </div>
        </div>
      )}

      <div className="border border-border rounded-sm overflow-hidden [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4">
        <DataTable columns={columns} data={data} />
      </div>
    </div>
  )
}

const columns: ColumnDef<FuseRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Fuse</span>
          <ArrowDownUp className="h-3 w-3" />
        </button>
      )
    },
    cell: ({ row }) => {
      const { name, key, description } = row.original
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono">{name}</span>
          <CopyButton value={key} />
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-5 h-5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )
    },
  },
  {
    accessorKey: 'scope',
    header: ({ column }) => {
      return (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Scope</span>
          <ArrowDownUp className="h-3 w-3" />
        </button>
      )
    },
    cell: ({ row }) => {
      const { scope } = row.original
      return scope
    },
  },
  {
    accessorKey: 'isBurnt',
    header: ({ column }) => {
      return (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Burnt</span>
          <ArrowDownUp className="h-3 w-3" />
        </button>
      )
    },
    cell: ({ row }) => {
      const { isBurnt } = row.original
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-xs border-transparent',
            isBurnt
              ? 'bg-warning-fill text-warning-text'
              : 'bg-default-fill text-default-text',
          )}
        >
          {isBurnt ? <Flame className="size-4" /> : <Ban className="size-4" />}
          <span>{isBurnt ? 'True' : 'False'}</span>
        </Badge>
      )
    },
  },
]

const V2NameMessage = () => (
  <MessageCard
    icon={<Info className="size-6" />}
    title="Fuses not available"
    description={
      <>
        <p>Fuses are only available for wrapped ENSv1 names.</p>
        <p className="text-sm mt-2">
          This name is not wrapped or is not an ENSv1 name.
        </p>
      </>
    }
  />
)
