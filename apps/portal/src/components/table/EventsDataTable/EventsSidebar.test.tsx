import { render, screen } from '@testing-library/react'
import type { Hash } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { BaseEvent, EventsTableData } from './types'

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

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  createConfig: vi.fn(() => ({})),
  useTransaction: vi.fn(() => ({
    data: {
      from: '0x123' as `0x${string}`,
      to: '0x456' as `0x${string}`,
      blockNumber: BigInt(12345),
      chainId: 11155111,
    },
    isLoading: false,
    error: null,
  })),
  useChainId: () => 11155111,
  useConfig: () => ({
    chains: [
      {
        id: 11155111,
        blockExplorers: {
          default: { url: 'https://sepolia.etherscan.io' },
        },
      },
    ],
  }),
}))

// Mock other dependencies
vi.mock('@/components/EntityBadge', () => ({
  EntityBadge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="entity-badge">{children}</span>
  ),
}))

vi.mock('@/components/CopyableRecord', () => ({
  CopyableRecord: ({ displayValue }: { displayValue: React.ReactNode }) => (
    <div>{displayValue}</div>
  ),
}))

vi.mock('@/components/table/EventsDataTable/AddressDisplay', () => ({
  AddressDisplay: ({ address }: { address: string }) => (
    <span data-testid="address-display">{address}</span>
  ),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-testid="sheet" data-open={open}>
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <div data-testid="name-avatar">{name}</div>
  ),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

vi.mock('@/utils/formatting/formatTimestamp', () => ({
  formatTimestamp: (timestamp?: bigint) =>
    timestamp ? '2024-01-01 12:00:00' : undefined,
}))

vi.mock('./TransactionEvents', () => ({
  TransactionEvents: ({ events }: { events: BaseEvent[] }) => (
    <div data-testid="transaction-events">{events.length} events</div>
  ),
}))

// Need to dynamically import the component after mocks are set up
const { EventsSidebar } = await import('./EventsSidebar')

const createMockEvent = (id: string, type: string): BaseEvent => ({
  id,
  type,
  category: 'domain',
  details: {},
})

const createMockTableData = (
  transactionID: string,
  eventCount = 1,
): EventsTableData => ({
  transactionID,
  blockNumber: 12345,
  timestamp: BigInt(1234567890),
  from: '0x123' as `0x${string}`,
  events: Array.from({ length: eventCount }, (_, i) =>
    createMockEvent(`event${i}`, 'Transfer'),
  ),
})

describe('EventsSidebar', () => {
  const mockSetOpen = vi.fn()

  it('should render children', () => {
    render(
      <EventsSidebar
        transaction={null}
        name="test.eth"
        open={false}
        setOpen={mockSetOpen}
      >
        <div>Child content</div>
      </EventsSidebar>,
    )

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should show "No transaction selected" when row is null', () => {
    render(
      <EventsSidebar
        transaction={null}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText('No transaction selected')).toBeInTheDocument()
  })

  it('should render transaction title', () => {
    render(
      <EventsSidebar
        transaction={null}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText('Transaction')).toBeInTheDocument()
  })

  it('should pass open state to Sheet', () => {
    const { container } = render(
      <EventsSidebar
        transaction={null}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    const sheet = container.querySelector('[data-testid="sheet"]')
    expect(sheet).toHaveAttribute('data-open', 'true')
  })

  it('should display name when row is provided', () => {
    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="vitalik.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    // Name appears in both NameAvatar and CopyableRecord
    const nameElements = screen.getAllByText('vitalik.eth')
    expect(nameElements.length).toBeGreaterThan(0)
  })

  it('should display transaction hash when row is provided', () => {
    const mockData = createMockTableData('0x123abc' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText('0x123abc')).toBeInTheDocument()
  })

  it('should display formatted timestamp when available', () => {
    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText(/2024-01-01 12:00:00 UTC/)).toBeInTheDocument()
  })

  it('should display network information', () => {
    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText('Sepolia')).toBeInTheDocument()
  })

  it('should display from address', () => {
    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    // Should render AddressDisplay for "from" address
    const addressDisplays = screen.getAllByTestId('address-display')
    expect(addressDisplays.length).toBeGreaterThan(0)
  })

  it('should render TransactionEvents component with events', () => {
    const mockData = createMockTableData('0x123' as Hash, 3)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByTestId('transaction-events')).toBeInTheDocument()
    expect(screen.getByText('3 events')).toBeInTheDocument()
  })
})

describe('EventsSidebar - Loading and Error States', () => {
  const mockSetOpen = vi.fn()

  it('should show loading skeletons when transaction is loading', async () => {
    // Mock loading state
    const useTransaction = await import('wagmi').then((m) => m.useTransaction)
    vi.mocked(useTransaction).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any)

    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(3)
  })

  it('should show error message when transaction fails to load', async () => {
    // Mock error state
    const useTransaction = await import('wagmi').then((m) => m.useTransaction)
    vi.mocked(useTransaction).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load transaction'),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any)

    const mockData = createMockTableData('0x123' as Hash)
    const mockTransaction = mockData

    render(
      <EventsSidebar
        transaction={mockTransaction}
        name="test.eth"
        open={true}
        setOpen={mockSetOpen}
      >
        <div>Table</div>
      </EventsSidebar>,
    )

    expect(screen.getByText(/Error loading transaction/)).toBeInTheDocument()
    expect(screen.getByText(/Failed to load transaction/)).toBeInTheDocument()
  })
})
