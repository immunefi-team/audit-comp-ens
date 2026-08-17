import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import * as v from 'valibot'
import { useConnection } from 'wagmi'
import patternBg from '@/assets/pattern-bg.svg'
import { getDomainsQuery } from '@/features/dashboard/service/queries/getDashboardDomains'
import { CheckAvailability } from '@/features/landing/check-availability/CheckAvailability'
import { FeaturesCarousel } from '@/features/landing/FeaturesCarousel'
import { IntegrationsSection } from '@/features/landing/IntegrationsSection'
import { ProfilesShowcase } from '@/features/landing/ProfilesShowcase'
import { getConnectionCookie } from '@/lib/connection-cookie'
import { useSmartAccountContext } from '@/lib/smart-account'

const LandingPage = () => {
  const navigate = useNavigate()
  useRedirectToDashboard()

  return (
    <div
      style={{
        background: `url("${patternBg}") center/30px repeat`,
      }}
    >
      {/* Hero Section */}
      <div className="mx-auto flex w-full-[2rem] flex-col items-center pt-11">
        <h1 className="text-center text-temp-64px">
          <span className="font-normal text-ens-lapis-core">
            <Trans>Claim your</Trans>
          </span>
          <br />
          <span className="font-serif text-ens-lapis-dense italic">
            <Trans>web3 username</Trans>
          </span>
        </h1>
        <p className="mt-6 text-center font-normal text-ens-lapis-core text-temp-32px">
          <Trans>A simple, portable identity that you control</Trans>
        </p>
        <div className="mt-11 w-full max-w-3xl">
          <CheckAvailability
            onRegistrationComplete={(name) => {
              navigate({ to: '/register/$name', params: { name } })
            }}
          />
        </div>
      </div>

      <FeaturesCarousel />

      <ProfilesShowcase />

      <IntegrationsSection />
    </div>
  )
}

const useRedirectToDashboard = () => {
  const navigate = useNavigate()
  const { landing } = Route.useSearch()
  const { ownerAddress } = useSmartAccountContext()
  const { isConnecting, isReconnecting } = useConnection()

  const hasDomains = useQuery({
    ...getDomainsQuery({
      where: {
        owner: ownerAddress,
      },
      first: 1,
    }),
    enabled: !!ownerAddress,
    select: (data) => data?.domains.length > 0,
  })

  useEffect(() => {
    // Defer the redirect until the wallet connection has settled. Navigating
    // mid-(re)connect races TanStack Router's match state (a transient pending
    // match whose `Outlet` throws `undefined` → blank page). The effect
    // re-runs once `isConnecting`/`isReconnecting` clear, so the redirect still
    // happens — just from a stable state.
    if (isConnecting || isReconnecting) return
    if (
      hasDomains.data &&
      hasDomains.isSuccess &&
      !hasDomains.isPaused &&
      !landing
    ) {
      navigate({ to: '/dashboard' })
    }
  }, [
    hasDomains.data,
    hasDomains.isSuccess,
    hasDomains.isPaused,
    navigate,
    landing,
    isConnecting,
    isReconnecting,
  ])
}

export const Route = createFileRoute('/')({
  component: LandingPage,
  validateSearch: v.object({
    /** Force landing page to be shown, don't redirect to dashboard */
    landing: v.optional(v.boolean()),
  }),
  beforeLoad: async ({ context: { queryClient }, search: { landing } }) => {
    // Cookie based check for wallet connection which allows server side redirects and faster loading times
    const connectedAddress = getConnectionCookie()

    // If the user is connected and has domains, redirect to the dashboard, otherwise let them stay on the landing page
    if (connectedAddress) {
      const domains = await queryClient.fetchQuery(
        getDomainsQuery({
          where: {
            owner: connectedAddress,
          },
          first: 1,
        }),
      )

      if (domains.domains.length > 0 && !landing) {
        throw redirect({ to: '/dashboard' })
      }
    }
  },
})
