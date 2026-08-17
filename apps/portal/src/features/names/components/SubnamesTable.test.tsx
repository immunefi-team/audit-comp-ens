import { fireEvent, render, screen } from '@testing-library/react'
import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

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
    <a href={to} data-params={JSON.stringify(params)}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/components/CopyableRecord', () => ({
  CopyableRecord: ({ value, href }: { value: string; href: string }) => (
    <a href={href} data-testid="copyable-record">
      {value}
    </a>
  ),
}))

vi.mock('@/components/table/SortButton', () => ({
  SortButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick} data-testid="sort-button">
      {children}
    </button>
  ),
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <div data-testid="name-avatar">{name}</div>
  ),
}))

vi.mock('@/components/EntityBadge', () => ({
  EntityBadge: ({
    children,
    name,
    variant,
    showAvatar,
  }: {
    children: React.ReactNode
    name?: string
    variant?: string
    showAvatar?: boolean
  }) => (
    <span data-testid="entity-badge">
      {showAvatar && variant === 'name' && name ? (
        <span data-testid="name-avatar">{name}</span>
      ) : null}
      {children}
    </span>
  ),
}))

vi.mock('@/utils/formatting/truncateAddress', () => ({
  truncateAddress: (address: string) => `${address.slice(0, 6)}...`,
}))

const { SubnamesTable } = await import('./SubnamesTable')

const createMockSubname = (
  name: string,
  owner: Address = '0x1234567890123456789012345678901234567890',
) => ({
  name,
  owner,
})

describe('SubnamesTable', () => {
  it('renders the header with title and search input', () => {
    render(
      <SubnamesTable
        subnames={[createMockSubname('sub1.test.eth')]}
        name="test.eth"
      />,
    )

    expect(screen.getByText('1 subname')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('renders empty state without search input when no subnames', () => {
    render(<SubnamesTable subnames={[]} name="test.eth" />)

    expect(screen.getByText('Subnames')).toBeInTheDocument()
    expect(screen.getByText('No subnames yet')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('renders subnames in the table', () => {
    const subnames = [
      createMockSubname('sub1.test.eth'),
      createMockSubname('sub2.test.eth'),
    ]

    render(<SubnamesTable subnames={subnames} name="test.eth" />)

    expect(screen.getAllByText('sub1.test.eth').length).toBeGreaterThan(0)
    expect(screen.getAllByText('sub2.test.eth').length).toBeGreaterThan(0)
  })

  it('renders sort buttons for columns', () => {
    render(<SubnamesTable subnames={[]} name="test.eth" />)

    const sortButtons = screen.getAllByTestId('sort-button')
    expect(sortButtons.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Subname')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('filters subnames when searching', () => {
    const subnames = [
      createMockSubname('alice.test.eth'),
      createMockSubname('bob.test.eth'),
      createMockSubname('charlie.test.eth'),
    ]

    render(<SubnamesTable subnames={subnames} name="test.eth" />)

    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    expect(screen.getAllByText('alice.test.eth').length).toBeGreaterThan(0)
    expect(screen.queryByText('bob.test.eth')).not.toBeInTheDocument()
    expect(screen.queryByText('charlie.test.eth')).not.toBeInTheDocument()
  })

  it('shows all subnames when search is cleared', () => {
    const subnames = [
      createMockSubname('alice.test.eth'),
      createMockSubname('bob.test.eth'),
    ]

    render(<SubnamesTable subnames={subnames} name="test.eth" />)

    const searchInput = screen.getByPlaceholderText('Search...')

    // Filter to show only alice
    fireEvent.change(searchInput, { target: { value: 'alice' } })
    expect(screen.queryByText('bob.test.eth')).not.toBeInTheDocument()

    // Clear filter
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getAllByText('alice.test.eth').length).toBeGreaterThan(0)
    expect(screen.getAllByText('bob.test.eth').length).toBeGreaterThan(0)
  })

  it('renders name avatars for each subname', () => {
    const subnames = [
      createMockSubname('sub1.test.eth'),
      createMockSubname('sub2.test.eth'),
    ]

    render(<SubnamesTable subnames={subnames} name="test.eth" />)

    const avatars = screen.getAllByTestId('name-avatar')
    expect(avatars.length).toBeGreaterThan(0)
  })

  it('renders create button when canCreateSubname is true', () => {
    render(<SubnamesTable subnames={[]} name="test.eth" canCreateSubname />)

    expect(screen.getByText('Create subname')).toBeInTheDocument()
  })

  it('does not render create button when canCreateSubname is false', () => {
    render(
      <SubnamesTable subnames={[]} name="test.eth" canCreateSubname={false} />,
    )

    expect(screen.queryByText('Create subname')).not.toBeInTheDocument()
  })
})
