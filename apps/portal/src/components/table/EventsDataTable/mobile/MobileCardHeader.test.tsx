import {
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BaseEvent, EventsTableData } from '../types'

// Mock icons
vi.mock('lucide-react', () => ({
  ArrowRightFromLineIcon: () => (
    <span data-testid="icon-arrow-right-from-line" />
  ),
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
}))

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
    'aria-label'?: string
  }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

// Need to dynamically import the component after mocks are set up
const { MobileCardHeader } = await import('./MobileCardHeader')

const createMockEvent = (id: string, type: string): BaseEvent => ({
  id,
  type,
  category: 'domain',
  details: {},
})

const createMockTableData = (
  transactionID: string,
  eventCount: number,
): EventsTableData => ({
  transactionID,
  blockNumber: 12345,
  timestamp: BigInt(1234567890),
  from: '0x123' as `0x${string}`,
  events: Array.from({ length: eventCount }, (_, i) =>
    createMockEvent(`event${i}`, 'Transfer'),
  ),
})

const createTestTable = (
  data: EventsTableData[],
  hasSidebar: boolean,
  onMoreClick?: (row: unknown) => void,
  expanded: Record<string, boolean> = {},
) => {
  const TestComponent = () => {
    const table = useReactTable({
      data,
      columns: [{ accessorKey: 'transactionID', header: 'Transaction' }],
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      state: { expanded },
      meta: onMoreClick ? { onMoreClick } : undefined,
    })

    const row = table.getRowModel().rows[0]
    return <MobileCardHeader row={row} table={table} hasSidebar={hasSidebar} />
  }

  return TestComponent
}

describe('MobileCardHeader', () => {
  it('should render expand button when events exist', () => {
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, false)
    render(<TestComponent />)

    expect(
      screen.getByRole('button', { name: /expand events/i }),
    ).toBeInTheDocument()
  })

  it('should not render expand button when no events', () => {
    const data = [createMockTableData('0x123', 0)]
    const TestComponent = createTestTable(data, false)
    render(<TestComponent />)

    expect(
      screen.queryByRole('button', { name: /expand events/i }),
    ).not.toBeInTheDocument()
  })

  it('should display event count', () => {
    const data = [createMockTableData('0x123', 5)]
    const TestComponent = createTestTable(data, false)
    render(<TestComponent />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should show chevron down icon when collapsed', () => {
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, false, undefined, {})
    render(<TestComponent />)

    expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-chevron-up')).not.toBeInTheDocument()
  })

  it('should show chevron up icon when expanded', () => {
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, false, undefined, { '0': true })
    render(<TestComponent />)

    expect(screen.getByTestId('icon-chevron-up')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument()
  })

  it('should toggle expansion when expand button is clicked', async () => {
    const user = userEvent.setup()
    const data = [createMockTableData('0x123', 3)]

    // Use a component that maintains state properly
    const TestComponent = () => {
      const [expanded, setExpanded] = React.useState<ExpandedState>({})

      const table = useReactTable({
        data,
        columns: [{ accessorKey: 'transactionID', header: 'Transaction' }],
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        state: { expanded },
        onExpandedChange: setExpanded,
      })

      const row = table.getRowModel().rows[0]
      return <MobileCardHeader row={row} table={table} hasSidebar={false} />
    }

    render(<TestComponent />)

    const expandButton = screen.getByRole('button', { name: /expand events/i })

    // Initially collapsed - should show chevron down
    expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument()

    // Click to expand
    await user.click(expandButton)

    // Should now show chevron up
    expect(screen.getByTestId('icon-chevron-up')).toBeInTheDocument()
  })

  it('should render more button when sidebar is enabled', () => {
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, true)
    render(<TestComponent />)

    const moreButton = screen.getByRole('button', { name: /more/i })
    expect(moreButton).toBeInTheDocument()
    expect(screen.getByTestId('icon-arrow-right-from-line')).toBeInTheDocument()
  })

  it('should not render more button when sidebar is disabled', () => {
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, false)
    render(<TestComponent />)

    expect(
      screen.queryByRole('button', { name: /more/i }),
    ).not.toBeInTheDocument()
  })

  it('should call onMoreClick when more button is clicked', async () => {
    const user = userEvent.setup()
    const onMoreClick = vi.fn()
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, true, onMoreClick)
    render(<TestComponent />)

    const moreButton = screen.getByRole('button', { name: /more/i })
    await user.click(moreButton)

    expect(onMoreClick).toHaveBeenCalledTimes(1)
  })

  it('should stop propagation when expand button is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, false)

    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test only
      // biome-ignore lint/a11y/noStaticElementInteractions: test only
      <div onClick={onClick}>
        <TestComponent />
      </div>,
    )

    const expandButton = screen.getByRole('button', { name: /expand events/i })
    await user.click(expandButton)

    // Parent onClick should not be called due to stopPropagation
    expect(onClick).not.toHaveBeenCalled()
  })

  it('should stop propagation when more button is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onMoreClick = vi.fn()
    const data = [createMockTableData('0x123', 3)]
    const TestComponent = createTestTable(data, true, onMoreClick)

    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test only
      // biome-ignore lint/a11y/noStaticElementInteractions: test only
      <div onClick={onClick}>
        <TestComponent />
      </div>,
    )

    const moreButton = screen.getByRole('button', { name: /more/i })
    await user.click(moreButton)

    // Parent onClick should not be called due to stopPropagation
    expect(onClick).not.toHaveBeenCalled()
    // But onMoreClick should still be called
    expect(onMoreClick).toHaveBeenCalledTimes(1)
  })

  it('should update aria-label when toggling expansion', async () => {
    const user = userEvent.setup()
    const data = [createMockTableData('0x123', 3)]

    // Use a component that maintains state properly
    const TestComponent = () => {
      const [expanded, setExpanded] = React.useState<ExpandedState>({})

      const table = useReactTable({
        data,
        columns: [{ accessorKey: 'transactionID', header: 'Transaction' }],
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        state: { expanded },
        onExpandedChange: setExpanded,
      })

      const row = table.getRowModel().rows[0]
      return <MobileCardHeader row={row} table={table} hasSidebar={false} />
    }

    render(<TestComponent />)

    const expandButton = screen.getByRole('button', { name: /expand events/i })
    expect(expandButton).toHaveAccessibleName('Expand events')

    // Click to expand
    await user.click(expandButton)

    expect(expandButton).toHaveAccessibleName('Collapse events')
  })
})
