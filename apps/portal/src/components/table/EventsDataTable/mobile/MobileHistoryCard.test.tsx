import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BaseEvent, EventsTableData } from '../types'

// Mock the sub-components
vi.mock('./MobileCardHeader', () => ({
  MobileCardHeader: () => <div data-testid="mobile-card-header" />,
}))

vi.mock('./MobileCardField', () => ({
  MobileCardField: ({
    label,
    children,
  }: {
    label: string
    children: React.ReactNode
  }) => <div data-testid={`field-${label.toLowerCase()}`}>{children}</div>,
}))

vi.mock('./MobileExpandedEvents', () => ({
  MobileExpandedEvents: ({ events }: { events: BaseEvent[] }) => (
    <div data-testid="mobile-expanded-events">{events.length} events</div>
  ),
}))

vi.mock('@/components/BlockExplorerTxLink', () => ({
  BlockExplorerTxLink: ({
    txHash,
  }: {
    txHash: string
    chainId?: number
    className?: string
  }) => <span>{`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}</span>,
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

vi.mock('@/utils/formatting/truncateAddress', () => ({
  truncateAddress: (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`,
}))

// Need to dynamically import the component after mocks are set up
const { MobileHistoryCard } = await import('./MobileHistoryCard')

const createMockEvent = (id: string, type: string): BaseEvent => ({
  id,
  type,
  category: 'domain',
  details: {},
})

const createMockTableData = (
  transactionID: string,
  options: {
    timestamp?: bigint
    from?: `0x${string}` | null
    network?: { name: string; icon?: string }
    eventCount?: number
  } = {},
): EventsTableData => ({
  transactionID,
  blockNumber: 12345,
  timestamp: options.timestamp,
  from: options.from !== undefined ? options.from : ('0x123' as `0x${string}`),
  network: options.network,
  events: Array.from({ length: options.eventCount ?? 1 }, (_, i) =>
    createMockEvent(`event${i}`, 'Transfer'),
  ),
})

const createTestTable = (
  data: EventsTableData[],
  columns: { id: string; accessorKey: string; header: string }[] = [
    {
      id: 'transactionID',
      accessorKey: 'transactionID',
      header: 'Transaction',
    },
    { id: 'timestamp', accessorKey: 'timestamp', header: 'Date' },
    { id: 'from', accessorKey: 'from', header: 'From' },
  ],
  expanded: Record<string, boolean> = {},
) => {
  const TestComponent = () => {
    const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      state: { expanded },
    })

    const row = table.getRowModel().rows[0]
    return <MobileHistoryCard row={row} table={table} />
  }

  return TestComponent
}

describe('MobileHistoryCard', () => {
  it('should render card header', () => {
    const data = [createMockTableData('0x123')]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    expect(screen.getByTestId('mobile-card-header')).toBeInTheDocument()
  })

  it('should display formatted date when timestamp is available', () => {
    const data = [
      createMockTableData('0x123', {
        timestamp: BigInt(1704110400), // 2024-01-01 12:00:00
      }),
    ]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    const dateField = screen.getByTestId('field-date')
    expect(dateField).toBeInTheDocument()
    expect(dateField.textContent).toContain('2024')
  })

  it('should not display date field when timestamp is missing', () => {
    const data = [createMockTableData('0x123', { timestamp: undefined })]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    expect(screen.queryByTestId('field-date')).not.toBeInTheDocument()
  })

  it('should display transaction hash', () => {
    const data = [createMockTableData('0xabcdef1234567890')]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    const transactionField = screen.getByTestId('field-transaction')
    expect(transactionField).toBeInTheDocument()
    expect(transactionField.textContent).toContain('0xabcd...7890')
  })

  it('should display from address when available', () => {
    const data = [
      createMockTableData('0x123', {
        from: '0x123456789abcdef' as `0x${string}`,
      }),
    ]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    const fromField = screen.getByTestId('field-from')
    expect(fromField).toBeInTheDocument()
    expect(screen.getByTestId('address-display')).toBeInTheDocument()
  })

  it('should not display from field when address is null', () => {
    const data = [createMockTableData('0x123', { from: null })]
    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    expect(screen.queryByTestId('field-from')).not.toBeInTheDocument()
  })

  it('should display network when enabled and available', () => {
    const data = [
      createMockTableData('0x123', {
        network: { name: 'Sepolia', icon: '/icons/eth.svg' },
      }),
    ]
    const columns = [
      {
        id: 'transactionID',
        accessorKey: 'transactionID',
        header: 'Transaction',
      },
      { id: 'timestamp', accessorKey: 'timestamp', header: 'Date' },
      { id: 'from', accessorKey: 'from', header: 'From' },
      { id: 'network', accessorKey: 'network', header: 'Network' },
    ]
    const TestComponent = createTestTable(data, columns)
    render(<TestComponent />)

    const networkField = screen.getByTestId('field-network')
    expect(networkField).toBeInTheDocument()
    expect(networkField.textContent).toContain('Sepolia')
  })

  it('should not display network when column is not enabled', () => {
    const data = [
      createMockTableData('0x123', {
        network: { name: 'Sepolia', icon: '/icons/eth.svg' },
      }),
    ]
    // Network column not included
    const columns = [
      {
        id: 'transactionID',
        accessorKey: 'transactionID',
        header: 'Transaction',
      },
      { id: 'timestamp', accessorKey: 'timestamp', header: 'Date' },
    ]
    const TestComponent = createTestTable(data, columns)
    render(<TestComponent />)

    expect(screen.queryByTestId('field-network')).not.toBeInTheDocument()
  })

  it('should not display network when data is missing', () => {
    const data = [createMockTableData('0x123', { network: undefined })]
    const columns = [
      {
        id: 'transactionID',
        accessorKey: 'transactionID',
        header: 'Transaction',
      },
      { id: 'timestamp', accessorKey: 'timestamp', header: 'Date' },
      { id: 'network', accessorKey: 'network', header: 'Network' },
    ]
    const TestComponent = createTestTable(data, columns)
    render(<TestComponent />)

    expect(screen.queryByTestId('field-network')).not.toBeInTheDocument()
  })

  it('should show expanded events when row is expanded', () => {
    const data = [createMockTableData('0x123', { eventCount: 3 })]
    const TestComponent = createTestTable(data, undefined, { '0': true })
    render(<TestComponent />)

    expect(screen.getByTestId('mobile-expanded-events')).toBeInTheDocument()
    expect(screen.getByText('3 events')).toBeInTheDocument()
  })

  it('should not show expanded events when row is collapsed', () => {
    const data = [createMockTableData('0x123', { eventCount: 3 })]
    const TestComponent = createTestTable(data, undefined, {})
    render(<TestComponent />)

    expect(
      screen.queryByTestId('mobile-expanded-events'),
    ).not.toBeInTheDocument()
  })

  it('should render network icon when available', () => {
    const data = [
      createMockTableData('0x123', {
        network: { name: 'Sepolia', icon: '/icons/eth.svg' },
      }),
    ]
    const columns = [
      {
        id: 'transactionID',
        accessorKey: 'transactionID',
        header: 'Transaction',
      },
      { id: 'network', accessorKey: 'network', header: 'Network' },
    ]
    const TestComponent = createTestTable(data, columns)
    render(<TestComponent />)

    const networkField = screen.getByTestId('field-network')
    const img = networkField.querySelector('img')
    expect(img).toHaveAttribute('src', '/icons/eth.svg')
    expect(img).toHaveAttribute('alt', 'Sepolia')
  })
})
