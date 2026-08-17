import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { zeroAddress } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { Button } from '@/components/ui/button'
import { RegistryRolesTable } from '@/features/registry/components/v2/RegistryRolesTable'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'

/**
 * Read-only registry roles for a name's own registry, for embedding on the name
 * roles page. Management happens on the registry page itself, so the slider is
 * disabled here and a "View" link points there instead.
 *
 * The roles page already gates on ENSv2 before rendering this, so registry
 * discovery (valid for V2 names only — see {@link getNameRegistriesQueryOptions})
 * can run directly. Renders nothing when the name has no registry of its own.
 */
export const NameRegistryRolesOverviewTable = ({ name }: { name: string }) => {
  const {
    data: registries,
    isLoading,
    error,
  } = useQuery(getNameRegistriesQueryOptions({ name }))

  if (isLoading) return <LoadingMessage />

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching registry roles. Please refresh the page."
      />
    )

  // Registries are ordered `[name, ...ancestors, root]`, so the name's own
  // registry is at index 0. Absent (or zero) means the name hasn't deployed one.
  const address = registries?.at(0)
  if (!address || address === zeroAddress) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-caps leading-none">{name} registry roles</h3>
        <Button className="text-muted-foreground" variant="ghost" asChild>
          <Link params={{ address }} to="/registry/$address/roles">
            <ArrowUpRight className="size-5" />
            View
          </Link>
        </Button>
      </div>
      <RegistryRolesTable address={address} disableEdit />
    </div>
  )
}
