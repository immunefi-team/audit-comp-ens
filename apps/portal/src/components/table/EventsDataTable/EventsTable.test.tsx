import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BaseEvent, EventsTableData } from './types'

// Mock the sub-components
vi.mock('./EventsTableRow', () => ({
  EventsTableRow: ({ row }: { row: { id: string } }) => (
    <tr data-testid={`table-row-${row.id}`} />
  ),
}))

vi.mock('./mobile/MobileHistoryCard', () => ({
  MobileHistoryCard: ({ row }: { row: { id: string } }) => (
    <div data-testid={`mobile-card-${row.id}`} />
  ),
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: { children: React.ReactNode }) => (
    <table {...props}>{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => (
    <th>{children}</th>
  ),
  TableCell: ({
    children,
    colSpan,
  }: {
    children: React.ReactNode
    colSpan?: number
  }) => <td colSpan={colSpan}>{children}</td>,
}))

// Need to dynamically import the component after mocks are set up
const { EventsTable } = await import('./EventsTable')

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

const createTestTable = (data: EventsTableData[]) => {
  const TestComponent = () => {
    const table = useReactTable({
      data,
      columns: [
        { accessorKey: 'transactionID', header: 'Transaction' },
        { accessorKey: 'timestamp', header: 'Date' },
      ],
      getCoreRowModel: getCoreRowModel(),
    })

    return <EventsTable table={table} />
  }

  return TestComponent
}

describe('EventsTable', () => {
  it('should render mobile view with cards', () => {
    const data = [
      createMockTableData('tx1'),
      createMockTableData('tx2'),
      createMockTableData('tx3'),
    ]

    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    // Should render mobile cards for each row
    expect(screen.getByTestId('mobile-card-0')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-2')).toBeInTheDocument()
  })

  it('should render desktop view with table', () => {
    const data = [
      createMockTableData('tx1'),
      createMockTableData('tx2'),
      createMockTableData('tx3'),
    ]

    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    // Should render table rows for each row
    expect(screen.getByTestId('table-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-2')).toBeInTheDocument()
  })

  it('should render table headers', () => {
    const data = [createMockTableData('tx1')]

    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    expect(screen.getByText('Transaction')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    const TestComponent = createTestTable([])
    render(<TestComponent />)

    const emptyCells = screen.getAllByText('No history found.')
    // Should appear in both mobile and desktop views
    expect(emptyCells).toHaveLength(2)
  })

  it('should render correct number of rows', () => {
    const data = [
      createMockTableData('tx1'),
      createMockTableData('tx2'),
      createMockTableData('tx3'),
      createMockTableData('tx4'),
      createMockTableData('tx5'),
    ]

    const TestComponent = createTestTable(data)
    render(<TestComponent />)

    // Desktop view should have 5 table rows
    expect(screen.getByTestId('table-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-2')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-3')).toBeInTheDocument()
    expect(screen.getByTestId('table-row-4')).toBeInTheDocument()

    // Mobile view should have 5 mobile cards
    expect(screen.getByTestId('mobile-card-0')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-3')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-card-4')).toBeInTheDocument()
  })
})
