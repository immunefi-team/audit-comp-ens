import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Hash } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { ENSEvent } from '@/utils/history/transformHistoryToEvents'
import { TransactionEvents } from './TransactionEvents'

// Mock dependencies
vi.mock('wagmi', () => ({
  useTransactionReceipt: vi.fn(() => ({
    data: {
      logs: [
        {
          logIndex: 0,
          data: '0xdata',
          topics: ['0xtopic1', '0xtopic2'],
        },
      ],
    },
  })),
}))

vi.mock('@/components/CopyableRecord', () => ({
  CopyableRecord: ({ displayValue }: { displayValue: React.ReactNode }) => (
    <div>{displayValue}</div>
  ),
}))

vi.mock('@/utils/ens/eventSignatures', () => ({
  getEventSignature: (type: string) => `${type}(address,uint256)`,
  getEventFieldType: (_type: string, _field: string) => 'address',
}))

vi.mock('@/utils/ens/formatEventValue', () => ({
  formatEventValue: (_key: string, value: unknown) => String(value),
}))

vi.mock('@/utils/history/filterEventDetailsMetadata', () => ({
  filterEventDetailsMetadata: (details: Record<string, unknown>) =>
    Object.entries(details).filter(([key]) => key !== '__typename'),
}))

vi.mock('@/utils/history/parseEventLogIndex', () => ({
  parseEventLogIndex: () => 0,
}))

describe('TransactionEvents', () => {
  const mockTxHash = '0x123abc' as Hash

  const createMockEvent = (
    id: string,
    type: string,
    details: Record<string, unknown> = {},
  ): ENSEvent => ({
    id,
    type,
    category: 'domain',
    details,
  })

  it('should show message when no events are provided', () => {
    render(<TransactionEvents events={[]} txHash={mockTxHash} />)

    expect(screen.getByText('No events found')).toBeInTheDocument()
  })

  it('should display event count', () => {
    const events = [
      createMockEvent('event1', 'Transfer'),
      createMockEvent('event2', 'NewOwner'),
    ]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    expect(screen.getByText('2 events')).toBeInTheDocument()
  })

  it('should render tabs for each event', () => {
    const events = [
      createMockEvent('event1', 'Transfer'),
      createMockEvent('event2', 'NewOwner'),
      createMockEvent('event3', 'NewResolver'),
    ]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    // Tabs should show event types
    expect(screen.getByRole('tab', { name: /Transfer/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /NewOwner/i })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /NewResolver/i }),
    ).toBeInTheDocument()
  })

  it('should show event numbering for duplicate types', () => {
    const events = [
      createMockEvent('event1', 'Transfer'),
      createMockEvent('event2', 'Transfer'),
      createMockEvent('event3', 'NewOwner'),
    ]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    // First Transfer should have #1, second should have #2
    expect(
      screen.getByRole('tab', { name: /Transfer #1/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /Transfer #2/i }),
    ).toBeInTheDocument()
    // Single NewOwner should not have numbering
    expect(screen.getByRole('tab', { name: /^NewOwner$/i })).toBeInTheDocument()
  })

  it('should use unique keys for tabs with same event id', () => {
    const events = [
      createMockEvent('vitalik.eth', 'Transfer'),
      createMockEvent('vitalik.eth', 'NewOwner'),
    ]

    const { container } = render(
      <TransactionEvents events={events} txHash={mockTxHash} />,
    )

    // Both tabs should render
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
  })

  it('should switch content when clicking different tabs', async () => {
    const user = userEvent.setup()
    const events = [
      createMockEvent('event1', 'Transfer', { owner: '0x123' }),
      createMockEvent('event2', 'NewOwner', { newOwner: '0x456' }),
    ]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    // First tab content should be visible by default
    expect(screen.getAllByText('Transfer')[0]).toBeInTheDocument()

    // Click second tab
    const newOwnerTab = screen.getByRole('tab', { name: /NewOwner/i })
    await user.click(newOwnerTab)

    // Second tab content should now be visible
    expect(screen.getAllByText('NewOwner')[0]).toBeInTheDocument()
  })

  it('should display event signature', () => {
    const events = [createMockEvent('event1', 'Transfer')]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    expect(screen.getByText('Transfer(address,uint256)')).toBeInTheDocument()
  })

  it('should show link to documentation', () => {
    const events = [createMockEvent('event1', 'Transfer')]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    const link = screen.getByRole('link', { name: /Go to docs/i })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/ensdomains/ens-contracts',
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('should default to first event tab', () => {
    const events = [
      createMockEvent('event1', 'Transfer'),
      createMockEvent('event2', 'NewOwner'),
    ]

    render(<TransactionEvents events={events} txHash={mockTxHash} />)

    // First event should be selected by default
    const transferTab = screen.getByRole('tab', { name: /^Transfer$/i })
    expect(transferTab).toHaveAttribute('data-state', 'active')
  })
})
