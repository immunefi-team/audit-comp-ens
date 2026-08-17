import { render, screen } from '@testing-library/react'
import { zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
  }) => (
    <a href={to} data-params={params ? JSON.stringify(params) : undefined}>
      {children}
    </a>
  ),
  createFileRoute: () => () => ({}),
  useParams: () => ({ name: 'irrelevant.eth' }),
}))

const mockAccount = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useConnection: () => ({ address: mockAccount }),
    useEnsName: () => ({ data: undefined }),
  }
})

// RegistryTreeItem links the contract badge to a block explorer; the hook reads
// useChainId/useConfig (needs a WagmiProvider) and the explorer href is
// irrelevant to these layout assertions. Stub it. Its own logic is covered by
// the getBlockExplorer*Url tests.
vi.mock('@/utils/blockExplorer/useBlockExplorerUrl', () => ({
  useBlockExplorerAddressUrl: () => undefined,
  useBlockExplorerTxUrl: () => undefined,
}))

// Stub heavy leaf components so we can render the tree in isolation and assert
// only the concerns of the redesigned registry section (tree rows + the inline
// configure form for the deepest, unconfigured registry).
//
// NameAvatar pulls in `useEnsAvatar`, which needs a WagmiProvider, and
// ConfigureRegistryForm owns its own deploy/role-gating queries and modal —
// both are exercised by their own tests.
vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <span data-testid="name-avatar" data-name={name} />
  ),
}))

vi.mock('@/features/registry/components/v2/ConfigureRegistryForm', () => ({
  ConfigureRegistryForm: ({ name }: { name: string }) => (
    <div data-testid="configure-registry-form" data-name={name} />
  ),
}))

// EntityBadge is the actions-enabled badge: it pulls in `useNavigate` and wagmi
// hooks (useChainId/useConfig) that need a router + WagmiProvider. These tests
// only care about the tree-row layout, so stub it to render its label/children
// (which carry the truncated addresses the assertions look for). The badge's own
// behaviour is covered by its dedicated tests.
vi.mock('@/components/EntityBadge', () => ({
  EntityBadge: ({
    children,
    label,
  }: {
    children?: React.ReactNode
    label?: string
  }) => (
    <span>
      {label ? <span>{label}</span> : null}
      <span>{children}</span>
    </span>
  ),
}))

// Mock useQuery to dispatch on the first segment of the query key.
const nameRegistriesResult: {
  data: unknown
  error: unknown
  isLoading: boolean
} = {
  data: undefined,
  error: undefined,
  isLoading: false,
}

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return {
    ...actual,
    useQuery: (options: { queryKey: readonly unknown[] }) => {
      const key = options.queryKey[0]
      if (key === 'nameRegistries') {
        return nameRegistriesResult
      }
      return { data: undefined, error: undefined, isLoading: false }
    },
  }
})

const { V2RegistryInfo } = await import(
  '@/features/registry/components/v2/RegistryInfo'
)

const ownerData = {
  owner: '0x1111111111111111111111111111111111111111',
  registryAddress: '0x1111111111111111111111111111111111111111',
  protocolVersion: 'ENSv2' as const,
} as const

const setRegistries = (registries: readonly (string | null)[] | undefined) => {
  nameRegistriesResult.data = registries
  nameRegistriesResult.error = undefined
  nameRegistriesResult.isLoading = false
}

// truncateAddress(address, 6, 4) — default separator is the ellipsis char '…'
const truncated = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`

describe('V2RegistryInfo', () => {
  beforeEach(() => {
    setRegistries(undefined)
  })

  it('renders the section header', () => {
    setRegistries([
      '0x2222222222222222222222222222222222222222',
      '0x1111111111111111111111111111111111111111',
      '0x0000000000000000000000000000000000000000',
    ])

    render(<V2RegistryInfo name="foo.eth" ownerData={ownerData} />)

    expect(screen.getByRole('heading', { name: /registry/i })).toBeVisible()
  })

  it('omits the configure form for a 2LD with a deployed subregistry', () => {
    const subregistry = '0x2222222222222222222222222222222222222222'
    setRegistries([
      subregistry, // foo.eth's subregistry
      '0x1111111111111111111111111111111111111111', // .eth registry
      '0x0000000000000000000000000000000000000000', // root
    ])

    render(<V2RegistryInfo name="foo.eth" ownerData={ownerData} />)

    // Deepest registry is configured, so the inline configure form is hidden.
    expect(
      screen.queryByTestId('configure-registry-form'),
    ).not.toBeInTheDocument()
    // The deployed subregistry renders as a row.
    expect(screen.getByText(truncated(subregistry))).toBeInTheDocument()
  })

  it('shows the configure form for a 2LD without a deployed subregistry', () => {
    setRegistries([
      zeroAddress, // foo.eth's subregistry not yet deployed
      '0x1111111111111111111111111111111111111111', // .eth registry
      '0x0000000000000000000000000000000000000000', // root
    ])

    render(<V2RegistryInfo name="foo.eth" ownerData={ownerData} />)

    const form = screen.getByTestId('configure-registry-form')
    expect(form).toHaveAttribute('data-name', 'foo.eth')
  })

  it('shows the configure form for a 3LD without a subregistry (WEB-249)', () => {
    const parent = '0x2222222222222222222222222222222222222222'
    setRegistries([
      zeroAddress, // 1.foo.eth's subregistry — not yet deployed
      parent, // foo.eth's subregistry (parent)
      '0x1111111111111111111111111111111111111111', // .eth registry
      '0x0000000000000000000000000000000000000000', // root
    ])

    render(<V2RegistryInfo name="1.foo.eth" ownerData={ownerData} />)

    const form = screen.getByTestId('configure-registry-form')
    expect(form).toHaveAttribute('data-name', '1.foo.eth')
    // The parent registry still renders as a row above the form.
    expect(screen.getByText(truncated(parent))).toBeInTheDocument()
  })

  it('renders the 4LD layout for a 5-tuple registries shape', () => {
    const parent = '0x3333333333333333333333333333333333333333'
    setRegistries([
      zeroAddress, // x.1.foo.eth's subregistry — not yet deployed
      parent, // 1.foo.eth's subregistry (parent)
      '0x2222222222222222222222222222222222222222', // foo.eth's subregistry
      '0x1111111111111111111111111111111111111111', // .eth registry
      '0x0000000000000000000000000000000000000000', // root
    ])

    render(<V2RegistryInfo name="x.1.foo.eth" ownerData={ownerData} />)

    const form = screen.getByTestId('configure-registry-form')
    expect(form).toHaveAttribute('data-name', 'x.1.foo.eth')
    expect(screen.getByText(truncated(parent))).toBeInTheDocument()
  })

  // Mirrors on-chain findRegistries(5.4.testing.fresh.eth) on Sepolia.
  it('renders the 5LD layout for a 6-tuple registries shape', () => {
    const parent = '0x1e39685086544eD33b561Fb2aa2B22192F5e3c47'
    setRegistries([
      zeroAddress, // 5.4.testing.fresh.eth — not yet deployed
      parent, // 4.testing.fresh.eth (parent)
      '0x4d337208B153620A9ec54Fb27aeF50743F7d4A50', // testing.fresh.eth
      '0x2f8eBF59b8dEeB06d6a0F0443b5bAd9509620d99', // fresh.eth
      '0x796fFF2E907449be8D5921BCC215B1b76D89d080', // .eth
      '0x3A3E15A5d27fF6F05C844313312f2e72096D3eD3', // root
    ])

    render(
      <V2RegistryInfo name="5.4.testing.fresh.eth" ownerData={ownerData} />,
    )

    const form = screen.getByTestId('configure-registry-form')
    expect(form).toHaveAttribute('data-name', '5.4.testing.fresh.eth')
    expect(screen.getByText(truncated(parent))).toBeInTheDocument()
  })
})
