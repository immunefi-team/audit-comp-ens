import {
  createFileRoute,
  redirect,
  useHydrated,
  useNavigate,
} from '@tanstack/react-router'
import { type ReactNode, useCallback } from 'react'
import { useConnection } from 'wagmi'
import { MigrationPage } from '@/features/migration/pages/MigrationPage'
import { MigrationUiProvider } from '@/features/migration/state/migrationUi.context'
import { useOnDisconnected } from '@/features/wallet/hooks/useOnDisconnected'
import { POSTHOG_FEATURE_FLAGS } from '@/lib/posthog/feature-flags'
import { getFeatureFlag } from '@/lib/posthog/get-feature-flag'
import { useSmartAccountContext } from '@/lib/smart-account'

export const Route = createFileRoute('/migration')({
  beforeLoad: async () => {
    const migrationAccess = await getFeatureFlag({
      data: { flag: POSTHOG_FEATURE_FLAGS.MIGRATION },
    })

    if (migrationAccess !== true) {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <MigrationUiProvider>
      <RequireConnectedWallet>
        <MigrationPage />
      </RequireConnectedWallet>
    </MigrationUiProvider>
  )
}

const MigrationRouteLoading = () => {
  return (
    <div
      aria-label="Loading migration"
      className="flex min-h-0 w-full flex-1 items-center justify-center"
      role="status"
    >
      <div
        className="size-5 animate-spin rounded-full border-2 border-ens-garnet-900/20 border-t-ens-garnet-900"
        data-testid="migration-loading-spinner"
      />
    </div>
  )
}

const RequireConnectedWallet = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const isHydrated = useHydrated()
  const { isConnecting, isReconnecting } = useConnection()
  const { hasInitialized, ownerAddress } = useSmartAccountContext()

  const handleDisconnect = useCallback(() => {
    navigate({ to: '/', replace: true })
  }, [navigate])

  useOnDisconnected(handleDisconnect)

  const isRestoringConnection =
    !isHydrated || isConnecting || isReconnecting || !hasInitialized

  if (isRestoringConnection || !ownerAddress) {
    return <MigrationRouteLoading />
  }

  return <>{children}</>
}
