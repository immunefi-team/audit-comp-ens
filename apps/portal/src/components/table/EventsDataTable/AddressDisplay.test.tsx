/** biome-ignore-all lint/suspicious/noExplicitAny: Mocking wagmi hooks requires 'any' casts due to complex library types */
import { render, screen } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddressDisplay } from './AddressDisplay'

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode
    to: string
    params: Record<string, string>
  }) => <a href={`${to}/${Object.values(params).join('/')}`}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('wagmi', () => ({
  useEnsName: vi.fn(),
}))

vi.mock('@/components/EntityBadge', () => ({
  EntityBadge: ({
    children,
    name,
    address,
    variant,
    showAvatar,
  }: {
    children: React.ReactNode
    name?: string
    address?: string
    variant: string
    showAvatar?: boolean
  }) => (
    <span data-testid="entity-badge" data-variant={variant}>
      {showAvatar && variant === 'name' && name ? (
        <div data-testid="name-avatar">{name}</div>
      ) : null}
      {children}
      {/* biome-ignore lint/a11y/noAmbiguousAnchorText: test mock; the anchor text is irrelevant because the test queries by role, not visible text */}
      <a
        href={variant === 'name' ? `/$name/${name}` : `/addr/$addr/${address}`}
      >
        link
      </a>
      <button
        type="button"
        data-testid="copy-button"
        data-value={name ?? address ?? ''}
      >
        Copy
      </button>
    </span>
  ),
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <div data-testid="name-avatar">{name}</div>
  ),
}))

vi.mock('@/utils/formatting/truncateAddress', () => ({
  truncateAddress: (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`,
}))

// Import useEnsName after mocking
import { useEnsName } from 'wagmi'

describe('AddressDisplay', () => {
  const mockAddress = '0x1234567890abcdef1234567890abcdef12345678'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state while fetching ENS name', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    const { container } = render(<AddressDisplay address={mockAddress} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Check for placeholder avatar by class
    const placeholder = container.querySelector('.w-5.h-5.rounded-sm')
    expect(placeholder).toBeInTheDocument()
  })

  it('should display ENS name when resolved', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: 'vitalik.eth',
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    // Check both places where the name appears
    expect(screen.getAllByText('vitalik.eth')).toHaveLength(2)
    expect(screen.getByTestId('name-avatar')).toHaveTextContent('vitalik.eth')
  })

  it('should display truncated address when no ENS name', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} short={true} />)

    // Should show truncated address
    expect(screen.getByText('0x1234...5678')).toBeInTheDocument()
  })

  it('should display full address when short=false and no ENS name', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} short={false} />)

    // Should show full address
    expect(screen.getByText(mockAddress)).toBeInTheDocument()
  })

  it('should render NameAvatar when ENS name exists', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: 'test.eth',
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    expect(screen.getByTestId('name-avatar')).toBeInTheDocument()
  })

  it('should not render an avatar when no ENS name', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    expect(screen.queryByTestId('name-avatar')).not.toBeInTheDocument()
  })

  it('should link to address page', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/addr/$addr/${mockAddress}`)
  })

  it('should use ENS name for copyable value when available', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: 'vitalik.eth',
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    expect(screen.getByTestId('copy-button')).toHaveAttribute(
      'data-value',
      'vitalik.eth',
    )
  })

  it('should use address for copyable value when no ENS name', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    expect(screen.getByTestId('copy-button')).toHaveAttribute(
      'data-value',
      mockAddress,
    )
  })

  it('should default to short=true', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    // Should show truncated by default
    expect(screen.getByText('0x1234...5678')).toBeInTheDocument()
  })

  it('should render avatar inside the entity badge', () => {
    vi.mocked(useEnsName).mockReturnValue({
      data: 'test.eth',
      isLoading: false,
    } as any)

    render(<AddressDisplay address={mockAddress} />)

    const badge = screen.getByTestId('entity-badge')
    const avatar = screen.getByTestId('name-avatar')
    expect(badge).toContainElement(avatar)
  })

  it('should handle different address formats', () => {
    const shortAddress = '0x123' as Address

    vi.mocked(useEnsName).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    render(<AddressDisplay address={shortAddress} />)

    expect(screen.getByRole('link')).toBeInTheDocument()
  })
})
