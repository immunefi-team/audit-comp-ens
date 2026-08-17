import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnection } from 'wagmi'
import { useOnDisconnected } from '@/features/wallet/hooks/useOnDisconnected'
import { useSmartAccountContext } from '@/lib/smart-account'
import { Route } from './dashboard'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  redirect: (options: unknown) => ({ options }),
  useNavigate: () => navigateMock,
}))

vi.mock('@/features/dashboard/pages/DashboardPage', () => ({
  DashboardPage: () => <div data-testid="dashboard-page" />,
}))

vi.mock('@/features/wallet/hooks/useOnDisconnected', () => ({
  useOnDisconnected: vi.fn(),
}))

vi.mock('@/lib/smart-account', () => ({
  useSmartAccountContext: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
}))

const mockSmartAccount = (state: {
  isLoading: boolean
  hasInitialized: boolean
  isConnected: boolean
}) => {
  // biome-ignore lint/suspicious/noExplicitAny: only the fields the route reads matter.
  vi.mocked(useSmartAccountContext).mockReturnValue(state as any)
}

const mockWalletConnection = (state: {
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
}) => {
  vi.mocked(useConnection).mockReturnValue(
    state as ReturnType<typeof useConnection>,
  )
}

const renderRoute = () => {
  const Component = Route.options.component as ComponentType
  return render(<Component />)
}

describe('/dashboard route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnDisconnected).mockImplementation(() => undefined)
    mockSmartAccount({
      isLoading: false,
      hasInitialized: true,
      isConnected: true,
    })
    mockWalletConnection({
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
    })
  })

  it('does not define a beforeLoad guard so external handoffs can hydrate first', () => {
    expect(Route.options.beforeLoad).toBeUndefined()
  })

  it('shows a centered spinner while the client wallet restores', () => {
    mockSmartAccount({
      isLoading: false,
      hasInitialized: false,
      isConnected: false,
    })

    renderRoute()

    expect(screen.getByTestId('dashboard-loading-spinner')).not.toBeNull()
    expect(screen.queryByTestId('dashboard-page')).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('renders the dashboard for a settled connected wallet', () => {
    renderRoute()

    expect(screen.getByTestId('dashboard-page')).not.toBeNull()
    expect(screen.queryByTestId('dashboard-loading-spinner')).toBeNull()
  })

  it('renders the dashboard when wagmi is connected but the smart account is unavailable', () => {
    mockSmartAccount({
      isLoading: false,
      hasInitialized: true,
      isConnected: false,
    })
    mockWalletConnection({
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
    })

    renderRoute()

    expect(screen.getByTestId('dashboard-page')).not.toBeNull()
    expect(screen.queryByTestId('dashboard-loading-spinner')).toBeNull()
  })

  it('redirects through the reconnect-aware disconnect hook', () => {
    vi.mocked(useOnDisconnected).mockImplementation((onDisconnect) => {
      onDisconnect()
    })

    renderRoute()

    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })
})
