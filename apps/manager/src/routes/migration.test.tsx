import { useHydrated } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnection } from 'wagmi'
import { useOnDisconnected } from '@/features/wallet/hooks/useOnDisconnected'
import { useSmartAccountContext } from '@/lib/smart-account'
import { Route } from './migration'

const navigateMock = vi.hoisted(() => vi.fn())
const getFeatureFlagMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  redirect: (options: unknown) => ({ options }),
  useHydrated: vi.fn(),
  useNavigate: () => navigateMock,
}))

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
}))

vi.mock('@/features/wallet/hooks/useOnDisconnected', () => ({
  useOnDisconnected: vi.fn(),
}))

vi.mock('@/lib/smart-account', () => ({
  useSmartAccountContext: vi.fn(),
}))

vi.mock('@/lib/posthog/get-feature-flag', () => ({
  getFeatureFlag: getFeatureFlagMock,
}))

vi.mock('@/features/migration/pages/MigrationPage', () => ({
  MigrationPage: () => <div data-testid="migration-page" />,
}))

vi.mock('@/features/migration/state/migrationUi.context', () => ({
  MigrationUiProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="migration-provider">{children}</div>
  ),
}))

type ConnectionState = {
  status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
  isConnecting: boolean
  isReconnecting: boolean
}

const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111'

const mockConnection = (state: ConnectionState) => {
  // biome-ignore lint/suspicious/noExplicitAny: only the fields the route reads matter.
  vi.mocked(useConnection).mockReturnValue(state as any)
}

const mockSmartAccount = (state: {
  hasInitialized: boolean
  isConnected: boolean
  ownerAddress: string | null
}) => {
  // biome-ignore lint/suspicious/noExplicitAny: only the fields the route reads matter.
  vi.mocked(useSmartAccountContext).mockReturnValue(state as any)
}

const renderRoute = () => {
  const Component = Route.options.component as ComponentType
  return render(<Component />)
}

const runBeforeLoad = () => {
  const beforeLoad = Route.options.beforeLoad

  if (!beforeLoad) throw new Error('Expected migration beforeLoad guard')

  return beforeLoad({} as never)
}

describe('/migration route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useHydrated).mockReturnValue(true)
    vi.mocked(useOnDisconnected).mockImplementation(() => undefined)
    mockConnection({
      status: 'connected',
      isConnecting: false,
      isReconnecting: false,
    })
    mockSmartAccount({
      hasInitialized: true,
      isConnected: true,
      ownerAddress: OWNER_ADDRESS,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows direct server requests when the migration flag is enabled', async () => {
    vi.stubGlobal('window', undefined)
    getFeatureFlagMock.mockResolvedValue(true)

    await expect(runBeforeLoad()).resolves.toBeUndefined()
    expect(getFeatureFlagMock).toHaveBeenCalledWith({
      data: { flag: 'migration' },
    })
  })

  it('redirects direct server requests when the migration flag is disabled', async () => {
    vi.stubGlobal('window', undefined)
    getFeatureFlagMock.mockResolvedValue(false)

    await expect(runBeforeLoad()).rejects.toEqual({
      options: { to: '/dashboard', replace: true },
    })
  })

  it('redirects direct server requests when migration access cannot be evaluated', async () => {
    vi.stubGlobal('window', undefined)
    getFeatureFlagMock.mockResolvedValue(null)

    await expect(runBeforeLoad()).rejects.toEqual({
      options: { to: '/dashboard', replace: true },
    })
  })

  it('redirects disabled client-side navigation through the server checker', async () => {
    getFeatureFlagMock.mockResolvedValue(false)

    await expect(runBeforeLoad()).rejects.toEqual({
      options: { to: '/dashboard', replace: true },
    })
    expect(getFeatureFlagMock).toHaveBeenCalledWith({
      data: { flag: 'migration' },
    })
  })

  it('waits during wallet restoration before rendering or redirecting', () => {
    mockConnection({
      status: 'reconnecting',
      isConnecting: false,
      isReconnecting: true,
    })
    mockSmartAccount({
      hasInitialized: false,
      isConnected: false,
      ownerAddress: null,
    })

    renderRoute()

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('migration-page')).toBeNull()
  })

  it('does not redirect before the router has hydrated, even if wagmi initially reports disconnected', () => {
    vi.mocked(useHydrated).mockReturnValue(false)
    mockConnection({
      status: 'disconnected',
      isConnecting: false,
      isReconnecting: false,
    })
    mockSmartAccount({
      hasInitialized: true,
      isConnected: false,
      ownerAddress: null,
    })

    renderRoute()

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('migration-page')).toBeNull()
  })

  it('renders migration when the smart account is connected even if wagmi reports the initial hard-load disconnected frame', () => {
    mockConnection({
      status: 'disconnected',
      isConnecting: false,
      isReconnecting: false,
    })

    renderRoute()

    expect(screen.getByTestId('migration-page')).not.toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('renders migration for a settled connected wallet', () => {
    renderRoute()

    expect(screen.getByTestId('migration-page')).not.toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not redirect while wagmi is connected but the smart account is still catching up', () => {
    mockSmartAccount({
      hasInitialized: true,
      isConnected: false,
      ownerAddress: OWNER_ADDRESS,
    })

    renderRoute()

    expect(screen.getByTestId('migration-page')).not.toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('waits when wagmi is connected but no owner address is available yet', () => {
    mockSmartAccount({
      hasInitialized: true,
      isConnected: false,
      ownerAddress: null,
    })

    renderRoute()

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('migration-page')).toBeNull()
  })

  it('waits instead of redirecting on the initial hard-load disconnected frame', () => {
    mockConnection({
      status: 'disconnected',
      isConnecting: false,
      isReconnecting: false,
    })
    mockSmartAccount({
      hasInitialized: true,
      isConnected: false,
      ownerAddress: null,
    })

    renderRoute()

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('migration-page')).toBeNull()
    expect(screen.getByTestId('migration-loading-spinner')).not.toBeNull()
  })

  it('redirects through the reconnect-aware disconnect hook', () => {
    vi.mocked(useOnDisconnected).mockImplementation((onDisconnect) => {
      onDisconnect()
    })

    renderRoute()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/',
      replace: true,
    })
  })
})
