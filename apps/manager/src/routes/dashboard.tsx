import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useConnection } from 'wagmi'
import { DashboardLoading } from '@/features/dashboard/components/DashboardLoading'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { useOnDisconnected } from '@/features/wallet/hooks/useOnDisconnected'
import { useSmartAccountContext } from '@/lib/smart-account'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { isLoading, hasInitialized, isConnected } = useSmartAccountContext()
  const {
    isConnected: isWalletConnected,
    isConnecting,
    isReconnecting,
  } = useConnection()

  // Client-side only so external handoffs can hydrate wallet state first.
  useOnDisconnected(() => {
    navigate({ to: '/' })
  })

  if (isLoading || !hasInitialized || isConnecting || isReconnecting) {
    return <DashboardLoading />
  }

  if (!isConnected && !isWalletConnected) {
    return <DashboardLoading />
  }

  return (
    <div className="flex flex-1 flex-col bg-[#FCFBFB]">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardPage />
      </Suspense>
    </div>
  )
}
