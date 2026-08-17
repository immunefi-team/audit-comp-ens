import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { type Address, isAddressEqual } from 'viem'
import { useConnection, useEnsResolver } from 'wagmi'
import { AvailableNameMessage } from '@/components/AvailableNameMessage'
import { ErrorMessage } from '@/components/ErrorMessage'
import { InvalidNameMessage } from '@/components/InvalidNameMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { UpgradeBanner } from '@/features/migration/components/UpgradeBanner'
import { getMigrationStatusQueryOptions } from '@/features/migration/hooks/useMigrationStatus'
import { ExpiryWithRegistrationData } from '@/features/profile/components/ExpiryWithRegistrationData'
import { GraceBanner } from '@/features/profile/components/GraceBanner'
import { NameProfileCard } from '@/features/profile/components/NameProfileCard'
import { Owner } from '@/features/profile/components/Owner'
import { ParentName } from '@/features/profile/components/ParentName'
import { ProtocolRow } from '@/features/profile/components/ProtocolRow'
import { ProtocolVersionWithCounter } from '@/features/profile/components/ProtocolVersionWithCounter'
import { RecentActivity } from '@/features/profile/components/RecentActivity'
import { RecordCount } from '@/features/profile/components/RecordCount'
import { RegistryCard } from '@/features/profile/components/RegistryCard'
import { ResolverCard } from '@/features/profile/components/ResolverCard'
import { SubnameCount } from '@/features/profile/components/SubnameCount'
import { getDnsSecEnabledQueryOptions } from '@/features/profile/hooks/useDnsSecEnabled'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { useGraceStatus } from '@/features/profile/hooks/useGraceStatus'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { getProfileQueryOptions } from '@/features/profile/hooks/useProfile'
import { RegistrationSuccessBanner } from '@/features/register/components/RegistrationSuccessBanner'
import { ExtendNameButton } from '@/features/renew/components/ExtendNameButton'
import { useCanExtend } from '@/features/renew/hooks/useCanExtend'
import { universalResolverAddress } from '@/lib/constants/universalResolver'
import {
  getTLD,
  is2LD,
  isClaimable,
  isRegistrable,
  isTLD,
} from '@/utils/ens/tldHelpers'
import { queryClient } from '@/utils/queryClient'
import { isValidEnsName } from '@/utils/token/isNormalized'
import { validateNameLength } from '@/utils/token/nameValidation'

type NameSearch = {
  readonly registered?: boolean
  readonly duration?: number
  readonly paid?: string
}

const validateNameSearch = (search: Record<string, unknown>): NameSearch => {
  if (search.registered !== true && search.registered !== 'true') return {}
  const duration = Number(search.duration)
  return {
    registered: true,
    duration: Number.isFinite(duration) ? duration : undefined,
    paid: typeof search.paid === 'string' ? search.paid : undefined,
  }
}

export const Route = createFileRoute('/$name/')({
  component: App,
  notFoundComponent: () => <NotFoundMessage />,
  validateSearch: validateNameSearch,
  loader: ({ params }) => {
    const tld = getTLD(params.name)
    return Promise.all([
      queryClient.prefetchQuery(getProfileQueryOptions({ name: params.name })),
      ...(tld !== 'eth'
        ? [queryClient.prefetchQuery(getDnsSecEnabledQueryOptions({ tld }))]
        : []),
    ])
  },
})

const Profile = ({
  name,
  resolverAddress,
}: {
  name: string
  resolverAddress?: Address
}) => {
  const { registered, duration, paid } = Route.useSearch()
  const registrationBanner =
    registered === true && duration !== undefined && paid !== undefined
      ? { durationSeconds: duration, paid }
      : null
  const tld = getTLD(name)
  const isEthTld = tld === 'eth'

  const ownerQuery = useQuery(getEnsOwnerQueryOptions({ name }))
  const profileQuery = useQuery(
    getProfileQueryOptions({
      name,
      protocolVersion: ownerQuery.data?.protocolVersion,
    }),
  )

  // Check DNSSEC for non-.eth TLDs to verify they're valid
  const dnsSecQuery = useQuery(
    getDnsSecEnabledQueryOptions({
      tld,
      // Only check for non-eth TLDs when we need to validate
      enabled: !isEthTld,
    }),
  )

  // For non-.eth TLDs, we need to wait for DNSSEC check
  const isTldValid = isEthTld || dnsSecQuery.data === true

  // `getAvailable` only supports .eth 2LDs (it re-appends `.eth`, so a non-.eth
  // 2LD like `alice.xyz` would query an unrelated `alice.xyz.eth` and throw).
  // Gate on isRegistrable so `enabled` matches the guards that consume it; fires
  // in parallel with the owner query to avoid a waterfall.
  const availabilityQuery = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })

  // When ownerQuery returns null, the registry has gated ownerOf on _isExpired,
  // so we can't tell from the chain alone whether the name is genuinely
  // unregistered or sitting in its 28-day v2 grace window. Default the hook to
  // 'ENSv2' in that case so it consults the indexer to detect grace state.
  // (v1 names in grace still return an owner from the registrar, so a null
  // owner implies the name isn't a v1-in-grace case.)
  const grace = useGraceStatus({
    name,
    protocolVersion: ownerQuery.data?.protocolVersion ?? 'ENSv2',
  })

  const { address: connectedAddress } = useConnection()

  // Migration eligibility is only meaningful for v1 names, and the verdict is
  // owner-scoped (evaluated for the connected wallet). Gate the query on both so
  // non-v1 names and disconnected viewers skip the on-chain checks and see no
  // migration status.
  const isV1Name = ownerQuery.data?.protocolVersion === 'ENSv1'

  const migrationQuery = useQuery({
    ...getMigrationStatusQueryOptions({ name, address: connectedAddress }),
    enabled: isV1Name && !!connectedAddress,
  })

  const { canExtend: graceCanExtend, isLoading: graceCanExtendLoading } =
    useCanExtend({
      name,
      protocolVersion: ownerQuery.data?.protocolVersion ?? 'ENSv2',
      enabled: grace.isInGrace,
    })

  // Loading states
  if (ownerQuery.isLoading) {
    return <LoadingSpinner title="Loading owner..." />
  }
  if (profileQuery.isLoading) {
    return <LoadingSpinner title="Loading profile..." />
  }

  // Wait for DNSSEC check for non-.eth TLDs
  if (!isEthTld && dnsSecQuery.isLoading) {
    return <LoadingSpinner title="Validating TLD..." />
  }

  // IMPORTANT: Check TLD validity FIRST, before showing any profile data
  // Even if owner data exists, we shouldn't show profiles for invalid TLDs
  if (!isTldValid) {
    return <InvalidNameMessage title="Invalid TLD" />
  }

  // If owner is null (not found), handle different cases
  if (!ownerQuery.data) {
    // Case 1: It's a TLD that doesn't exist (but is valid)
    if (isTLD(name)) {
      return (
        <NotFoundMessage
          title="TLD not found"
          description={
            <>
              The TLD <strong>{name}</strong> does not have any data in ENS yet.
            </>
          }
        />
      )
    }

    // Case 2: It's a 3LD+ that doesn't exist
    if (!is2LD(name)) {
      return (
        <NotFoundMessage
          title="Name not found"
          description={
            <>
              <strong>{name}</strong> does not exist.
            </>
          }
        />
      )
    }

    // Case 3: It's a 2LD - check availability
    if (availabilityQuery.isLoading) {
      return <LoadingSpinner title="Checking availability..." />
    }

    // Name is available
    if (availabilityQuery.data?.isAvailable) {
      // .eth names can be registered
      if (isRegistrable(name)) {
        const lengthError = validateNameLength(name)
        return lengthError ? (
          <InvalidNameMessage
            title="Name too short"
            description={lengthError}
          />
        ) : (
          <AvailableNameMessage name={name} />
        )
      }
      // Other valid TLD names - DNS import not available on ENSv2 yet
      if (isClaimable(name)) {
        return (
          <NotFoundMessage
            title="DNS import not available"
            description={
              <>
                <strong>{name}</strong> could be claimed via DNS import, but
                this feature isn't available yet on ENSv2.
              </>
            }
          />
        )
      }
    }

    // Wait for indexer before deciding between v2 grace and error states
    if (grace.isLoading) {
      return <LoadingSpinner title="Loading..." />
    }

    // Without indexer data we can't distinguish grace from genuinely missing,
    // so surface the failure rather than falling through to "Name not found".
    if (grace.error) {
      const errorMessage =
        (grace.error as { cause?: { message?: string } }).cause?.message ??
        'Failed to load registration data'
      return (
        <ErrorMessage title="Error loading name" description={errorMessage} />
      )
    }

    // V2 grace: registrar's _checkGrace still blocks re-registration, but the
    // registry's ownerOf returned zero. Render banner + Extend so the previous
    // owner can renew before the window closes.
    if (grace.isInGrace && grace.graceEndDate) {
      return (
        <div className="flex flex-col gap-8">
          <GraceBanner
            graceEndDate={grace.graceEndDate}
            canExtend={graceCanExtend}
          />
          <div className="flex flex-row justify-between items-center">
            <h1 className="font-serif text-4xl font-medium leading-none">
              {name}
            </h1>
            <ExtendNameButton name={name} protocolVersion="ENSv2" />
          </div>
        </div>
      )
    }

    // Handle errors
    if (ownerQuery.error) {
      return (
        <ErrorMessage
          title="Error loading name"
          description={ownerQuery.error.cause?.message}
        />
      )
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

    // Name is not available but we couldn't get owner info
    return (
      <ErrorMessage
        title="Name not found"
        description="Could not retrieve information for this name."
      />
    )
  }

  if (availabilityQuery.isLoading && isRegistrable(name)) {
    return <LoadingSpinner title="Checking availability..." />
  }

  if (availabilityQuery.error && isRegistrable(name)) {
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

  if (availabilityQuery.data?.isAvailable && isRegistrable(name)) {
    const lengthError = validateNameLength(name)
    return lengthError ? (
      <InvalidNameMessage title="Name too short" description={lengthError} />
    ) : (
      <AvailableNameMessage name={name} />
    )
  }

  // Profile query error - but we have owner, so name exists
  if (profileQuery.error) {
    // Don't show error for profile fetch failures on existing names
    // The name exists (we have owner), just profile data failed
    console.warn('Profile fetch failed:', profileQuery.error.cause?.message)
  }

  // Match the grace/canExtend default above: a missing protocolVersion means the
  // owner query hasn't resolved, and 'ENSv2' is the safe conservative choice.
  const resolvedProtocolVersion = ownerQuery.data.protocolVersion ?? 'ENSv2'

  const migration = migrationQuery.data
  // Migration status is owner-only: surface it (both the banner and the
  // Protocol-row label) only when the name is migratable AND the connected
  // wallet holds the v1 token. Non-owners and disconnected viewers see no
  // migration text.
  const isMigratableByConnectedOwner =
    migration?.migratable === true &&
    !!connectedAddress &&
    isAddressEqual(connectedAddress, migration.tokenHolder)

  // Suppress the upgrade prompt whenever the name is expired (grace period or
  // fully expired past grace) — the user must extend/renew first. The upgrade
  // banner reappears once the name is active again.
  const showUpgradeBanner =
    resolvedProtocolVersion === 'ENSv1' &&
    isMigratableByConnectedOwner &&
    !grace.isExpired

  return (
    <div className="flex flex-col gap-8">
      {registrationBanner && (
        <RegistrationSuccessBanner name={name} {...registrationBanner} />
      )}

      {grace.isInGrace && grace.graceEndDate && (
        <GraceBanner
          graceEndDate={grace.graceEndDate}
          canExtend={graceCanExtend || graceCanExtendLoading}
        />
      )}

      {showUpgradeBanner && <UpgradeBanner name={name} />}

      {/* Header */}
      <div className="flex flex-row justify-between items-center">
        <h1 className="font-serif text-4xl font-medium leading-none">{name}</h1>
        {resolvedProtocolVersion !== 'ENSv1' && (
          <ExtendNameButton
            name={name}
            protocolVersion={resolvedProtocolVersion}
          />
        )}
      </div>

      {/* Profile | metadata | counters at xl; counters wrap to their own row below that */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(min-content,1fr)] xl:grid-cols-[180px_auto_300px] xl:justify-between gap-3">
        {/* Left: avatar + bio + socials */}
        <NameProfileCard name={name} stacked />

        {/* Middle: metadata rows */}
        <div className="flex flex-col flex-1">
          <ExpiryWithRegistrationData
            name={name}
            protocolVersion={resolvedProtocolVersion}
          />
          <Owner
            owner={ownerQuery.data.owner}
            asRow
            label={grace.isInGrace ? 'Previous owner' : 'Owner'}
          />
          <ParentName name={name} asRow />
          {resolverAddress && (
            <ResolverCard name={name} resolverAddress={resolverAddress} asRow />
          )}
          <RegistryCard
            name={name}
            registryAddress={ownerQuery.data.registryAddress}
            asRow
            protocolVersion={resolvedProtocolVersion}
          />
          <ProtocolRow
            protocolVersion={resolvedProtocolVersion}
            migration={isMigratableByConnectedOwner ? migration : undefined}
            isLoading={migrationQuery.isLoading}
          />
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-1 gap-3 content-start sm:grid-cols-3 lg:col-span-2 xl:col-span-1 xl:grid-cols-1">
          <SubnameCount name={name} protocolVersion={resolvedProtocolVersion} />
          <ProtocolVersionWithCounter
            name={name}
            protocolVersion={resolvedProtocolVersion}
          />
          {resolverAddress && (
            <RecordCount
              name={name}
              records={profileQuery.data?.records}
              resolverAddress={resolverAddress}
            />
          )}
        </div>
      </div>

      {/* History */}
      <RecentActivity name={name} protocolVersion={resolvedProtocolVersion} />
    </div>
  )
}

function App() {
  const { name } = useParams({ from: '/$name/' })

  // Validate name format - must be a valid ENS name (normalized + ends with .eth)
  const isValidName = isValidEnsName(name)

  const {
    data: resolverAddress,
    isLoading,
    error,
  } = useEnsResolver({
    name,
    universalResolverAddress,
    query: {
      // Don't fetch resolver for invalid names
      enabled: isValidName,
    },
  })

  // Show 404 for invalid/malformed names
  if (!isValidName) {
    return <InvalidNameMessage title="Invalid name" />
  }

  if (error) {
    if (!is2LD(name) && !isTLD(name)) {
      return (
        <NotFoundMessage
          title="Name not found"
          description={
            <>
              <strong>{name}</strong> does not exist.
            </>
          }
        />
      )
    }

    const message =
      (error?.cause as Error | undefined)?.message ||
      (error as Error | undefined)?.message ||
      'Could not load data.'

    if (error.name === 'ChainDoesNotSupportContract')
      return (
        <ErrorMessage
          title="Error loading data"
          description="Chain does not have UniversalResolver"
        />
      )
    return <ErrorMessage title="Error loading data" description={message} />
  }

  if (isLoading) return <LoadingMessage />

  return <Profile name={name} resolverAddress={resolverAddress} />
}
