import type { QueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
} from '@tanstack/react-router'
import {
  NameFallbackCard,
  type NameFallbackReason,
} from '@/components/NameFallbackCard'
import { isPastGracePeriod } from '@/features/grace/utils/gracePeriod'
import { ProfileLoading } from '@/features/profile/components/view/ProfileLoading'
import { ProfileView } from '@/features/profile/components/view/ProfileView'
import { dnsSecEnabledQuery } from '@/features/profile/service/dnsSecEnabled'
import { profileExpiryQuery } from '@/features/profile/service/profileExpiry'
import { profileOwnerQuery } from '@/features/profile/service/profileOwner'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { profileRegistrationQuery } from '@/features/profile/service/profileRegistration'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { getRegistrationV2AvailabilityQueryOptions } from '@/features/register-v2/data/queries/availability.query'
import { parseName } from '@/features/register-v2/utils/name-parser'
import { seo } from '@/utils/seo'

// `/register/$name` redirects straight back here when the registrar says the
// name isn't free, so every hand off to it is gated on this.
const isFreeToRegister = async (
  queryClient: QueryClient,
  name: string,
): Promise<boolean> => {
  const availability = await queryClient
    .fetchQuery(getRegistrationV2AvailabilityQueryOptions(name))
    .catch(() => undefined)

  return availability?.isAvailable === true
}

// Classifies an ownerless name: .eth 2LDs with 3+ code points (the
// registrar counts code points, not UTF-16 units) can be registered,
// everything else maps to a fallback card reason
const classifyMissingName = (
  parsed: ReturnType<typeof parseName>,
): NameFallbackReason | 'registrable' => {
  if (!parsed.isOk() || parsed.value.tld !== 'eth') return 'not-imported'
  if (parsed.value.subLabels.length > 0) return 'not-found'
  if ([...parsed.value.label].length >= 3) return 'registrable'
  return 'too-short'
}

export const Route = createFileRoute('/$name/')({
  loader: async ({ params: { name }, context: { queryClient } }) => {
    const [profileRecords, ownerData] = await Promise.all([
      queryClient.ensureQueryData(profileRecordsQuery(name)),
      // Fetch, not ensure: `ensureQueryData` serves invalidated data, so a name
      // cached as ownerless pre-registration would redirect its owner away.
      queryClient.fetchQuery(profileOwnerQuery(name)),
    ])

    const parsed = parseName(name)
    const isEth = parsed.isOk() && parsed.value.tld === 'eth'

    // Validate the TLD before showing any profile data: a TLD is supported
    // if it's .eth or has DNSSEC enabled. On DoH failure, prefer the profile
    // fallback over a false "unsupported"
    if (!isEth) {
      const dnsSecEnabled = parsed.isOk()
        ? await queryClient
            .ensureQueryData(dnsSecEnabledQuery(parsed.value.tld))
            .catch(() => true)
        : false

      if (!dnsSecEnabled) {
        return { fallback: 'unsupported-tld' as const, description: undefined }
      }
    }

    // Name doesn't exist in v2 or v1
    if (!ownerData) {
      const missing = classifyMissingName(parsed)

      if (missing === 'registrable') {
        if (await isFreeToRegister(queryClient, name)) {
          throw redirect({
            params: { name },
            to: '/register/$name',
            replace: true,
          })
        }

        return { fallback: 'not-found' as const, description: undefined }
      }

      return { fallback: missing, description: undefined }
    }

    const [expiryData] = await Promise.all([
      queryClient.ensureQueryData(
        profileExpiryQuery(name, ownerData?.protocol),
      ),
      queryClient.prefetchQuery(
        profileRegistrationQuery(name, ownerData?.protocol),
      ),
    ])

    const expiryDate =
      expiryData?.expiry == null
        ? null
        : new Date(Number(expiryData.expiry) * 1000)
    const isPastGrace = isPastGracePeriod(expiryDate, ownerData.protocol)

    if (isPastGrace && (await isFreeToRegister(queryClient, name))) {
      throw redirect({
        params: { name },
        to: '/register/$name',
        replace: true,
      })
    }

    if (ownerData?.owner) {
      await queryClient.prefetchQuery(profileReverseNameQuery(ownerData.owner))
    }

    const description = profileRecords.texts.find(
      (r) => r.key === 'description',
    )?.value

    return {
      fallback: undefined,
      description,
    }
  },
  head: ({ params: { name }, loaderData }) => {
    const { description } = loaderData || {}
    const metaDescription = description || `View the ENS profile for ${name}`

    return {
      meta: seo({
        title: `${name} - ENS Profile`,
        description: metaDescription,
      }),
    }
  },
  ssr: false,
  component: RouteComponent,
  errorComponent: ProfileRouteError,
  pendingComponent: ProfileRoutePending,
})

function ProfileRoutePending() {
  const name = Route.useParams({ select: (params) => params.name })
  return <ProfileLoading name={name} />
}

function ProfileRouteError({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-center py-8">
        <div className="text-red-600">
          Error loading profile: {error.message}
        </div>
      </div>
    </div>
  )
}

function RouteComponent() {
  const name = Route.useParams({ select: (params) => params.name })
  const fallback = Route.useLoaderData({
    select: (data) => data.fallback,
  })

  if (fallback) return <NameFallbackCard name={name} reason={fallback} />

  return <ProfileView name={name} />
}
