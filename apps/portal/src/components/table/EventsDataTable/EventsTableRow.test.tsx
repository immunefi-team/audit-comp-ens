import type { Row } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventsTableRow } from './EventsTableRow'
import type { BaseEvent, EventsTableData } from './types'

// Mock dependencies
vi.mock('@/utils/events/extractFromAddress', () => ({
  extractFromAddress: vi.fn((details: Record<string, unknown>) => {
    if (details.owner) return details.owner
    return null
  }),
}))

vi.mock('@/components/table/EventsDataTable/AddressDisplay', () => ({
  AddressDisplay: ({ address }: { address: string }) => (
    <div data-testid="address-display">{address}</div>
  ),
}))

describe('EventsTableRow', () => {
  const createMockRow = (
    data: Partial<EventsTableData<BaseEvent>>,
    isExpanded = false,
  ): Row<EventsTableData<BaseEvent>> => {
    const mockRow = {
      original: {
        transactionID: '0xabc123',
        blockNumber: 100,
        from: null,
        events: [],
        ...data,
      },
      getIsExpanded: () => isExpanded,
      getVisibleCells: () => [
        {
          id: 'cell1',
          getContext: () => ({}),
          column: {
            columnDef: {
              cell: () => <div>Cell Content</div>,
            },
          },
        },
      ],
    } as unknown as Row<EventsTableData<BaseEvent>>

    return mockRow
  }

  it('should render main row with cell content', () => {
    const row = createMockRow({})

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByText('Cell Content')).toBeInTheDocument()
  })

  it('should not render expanded events when row is collapsed', () => {
    const row = createMockRow(
      {
        events: [
          {
            id: 'event1',
            type: 'Transfer',
            category: 'domain',
            details: { owner: '0x123' },
          },
        ],
      },
      false, // not expanded
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.queryByText('Transfer')).not.toBeInTheDocument()
  })

  it('should render expanded events when row is expanded', () => {
    const row = createMockRow(
      {
        events: [
          {
            id: 'event1',
            type: 'Transfer',
            category: 'domain',
            details: { owner: '0x123' },
          },
        ],
      },
      true, // expanded
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByText('Transfer')).toBeInTheDocument()
  })

  it('should display event type in expanded row', () => {
    const row = createMockRow(
      {
        events: [
          {
            id: 'event1',
            type: 'NameRegistered',
            category: 'domain',
            details: {},
          },
        ],
      },
      true,
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByText('NameRegistered')).toBeInTheDocument()
  })

  it('should show AddressDisplay when from address is present', () => {
    const row = createMockRow(
      {
        events: [
          {
            id: 'event1',
            type: 'Transfer',
            category: 'domain',
            details: { owner: '0xABCDEF' },
          },
        ],
      },
      true,
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByTestId('address-display')).toHaveTextContent('0xABCDEF')
  })

  it('should show dash when from address is missing', () => {
    const row = createMockRow(
      {
        events: [
          {
            id: 'event1',
            type: 'Transfer',
            category: 'domain',
            details: {}, // no address
          },
        ],
      },
      true,
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.queryByTestId('address-display')).not.toBeInTheDocument()
  })

  it('should render multiple expanded events', () => {
    const row = createMockRow(
      {
        transactionID: '0xabc123',
        events: [
          {
            id: 'event1',
            type: 'Transfer',
            category: 'domain',
            details: { owner: '0x111' },
          },
          {
            id: 'event2',
            type: 'NewOwner',
            category: 'domain',
            details: { owner: '0x222' },
          },
          {
            id: 'event3',
            type: 'NewResolver',
            category: 'domain',
            details: { owner: '0x333' },
          },
        ],
      },
      true,
    )

    render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    expect(screen.getByText('Transfer')).toBeInTheDocument()
    expect(screen.getByText('NewOwner')).toBeInTheDocument()
    expect(screen.getByText('NewResolver')).toBeInTheDocument()

    const addresses = screen.getAllByTestId('address-display')
    expect(addresses).toHaveLength(3)
  })

  it('should use unique keys for duplicate event ids', () => {
    const row = createMockRow(
      {
        transactionID: '0xabc123',
        events: [
          {
            id: 'vitalik.eth',
            type: 'Transfer',
            category: 'domain',
            details: { owner: '0x123' },
          },
          {
            id: 'vitalik.eth',
            type: 'NewOwner',
            category: 'domain',
            details: { owner: '0x456' },
          },
        ],
      },
      true,
    )

    const { container } = render(
      <table>
        <tbody>
          <EventsTableRow row={row} />
        </tbody>
      </table>,
    )

    // Both events should render (not de-duped)
    expect(screen.getByText('Transfer')).toBeInTheDocument()
    expect(screen.getByText('NewOwner')).toBeInTheDocument()

    // Check that we have the expected number of rows
    const rows = container.querySelectorAll('tr')
    expect(rows.length).toBeGreaterThan(1)
  })
})
