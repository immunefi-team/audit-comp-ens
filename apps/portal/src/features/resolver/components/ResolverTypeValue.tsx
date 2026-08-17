import { ExternalLink } from 'react-external-link'
import { type Address, isAddressEqual } from 'viem'
import { useIsPermissionedResolver } from '@/features/resolver/hooks/useIsPermissionedResolver'
import { officialPublicResolverAddress } from '@/lib/constants/universalResolver'

const AuditedNotice = ({
  name,
  docsHref,
}: {
  name: string
  docsHref: string
}) => (
  <p className="text-p text-foreground">
    This is an instance of the official{' '}
    <ExternalLink href={docsHref} className="underline">
      {name}
    </ExternalLink>
    . It is audited and is considered secure.
  </p>
)

/**
 * The resolver's Type row value: the audited notice for official resolvers
 * (Permissioned / Public), "Custom Resolver" otherwise. Replaces the old
 * page-level banner — per the WEB-649 DQA the notice belongs in the header
 * list's Type field, matching the Name > Resolver page.
 */
export const ResolverTypeValue = ({
  resolverAddress,
}: {
  resolverAddress: Address
}) => {
  const {
    data: isPermissionedResolver,
    isLoading,
    error,
  } = useIsPermissionedResolver({
    resolverAddress,
  })

  if (error)
    return <>{error instanceof Error ? error.message : 'Failed to load data'}</>

  if (isLoading)
    return <span className="text-ui text-muted-foreground">Loading…</span>

  if (isPermissionedResolver)
    return (
      <AuditedNotice
        name="ENS Permissioned Resolver"
        docsHref="https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/resolver/PermissionedResolver.sol"
      />
    )

  if (isAddressEqual(resolverAddress, officialPublicResolverAddress))
    return (
      <AuditedNotice
        name="ENS Public Resolver"
        docsHref="https://docs.ens.domains/resolvers/public/"
      />
    )

  return <span className="text-ui text-foreground">Custom Resolver</span>
}
