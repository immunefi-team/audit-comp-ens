import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BaseEvent } from '../types'
import { MobileExpandedEvents } from './MobileExpandedEvents'

// Mock the extractFromAddress utility
vi.mock('@/utils/events/extractFromAddress', () => ({
  extractFromAddress: vi.fn((details: Record<string, unknown>) => {
    if (details.owner) return details.owner
    if (details.registrant) return details.registrant
    if (details.newOwner) return details.newOwner
    return null
  }),
}))

// Mock AddressDisplay component
vi.mock('@/components/table/EventsDataTable/AddressDisplay', () => ({
  AddressDisplay: ({ address }: { address: string }) => (
    <div data-testid="address-display">{address}</div>
  ),
}))

describe('MobileExpandedEvents', () => {
  const createMockEvent = (
    id: string,
    type: string,
    details: Record<string, unknown> = {},
  ): BaseEvent => ({
    id,
    type,
    category: 'domain',
    details,
  })

  it('should render all events in the array', () => {
    const events = [
      createMockEvent('event1', 'Transfer', { owner: '0x123' }),
      createMockEvent('event2', 'NewOwner', { newOwner: '0x456' }),
      createMockEvent('event3', 'NewResolver', { registrant: '0x789' }),
    ]

    render(<MobileExpandedEvents events={events} />)

    expect(screen.getByText('Transfer')).toBeInTheDocument()
    expect(screen.getByText('NewOwner')).toBeInTheDocument()
    expect(screen.getByText('NewResolver')).toBeInTheDocument()
  })

  it('should display event type for each event', () => {
    const events = [createMockEvent('event1', 'NameRegistered', {})]

    render(<MobileExpandedEvents events={events} />)

    expect(screen.getByText('NameRegistered')).toBeInTheDocument()
    expect(screen.getByText('Event')).toBeInTheDocument()
  })

  it('should show from address when present', () => {
    const events = [
      createMockEvent('event1', 'Transfer', { owner: '0xABCDEF' }),
    ]

    render(<MobileExpandedEvents events={events} />)

    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByTestId('address-display')).toHaveTextContent('0xABCDEF')
  })

  it('should hide from section when address is missing', () => {
    const events = [createMockEvent('event1', 'Transfer', {})]

    render(<MobileExpandedEvents events={events} />)

    expect(screen.queryByText('From')).not.toBeInTheDocument()
    expect(screen.queryByTestId('address-display')).not.toBeInTheDocument()
  })

  it('should use unique keys for events with same id', () => {
    // Two events with the same id (same ENS name)
    const events = [
      createMockEvent('vitalik.eth', 'Transfer', { owner: '0x123' }),
      createMockEvent('vitalik.eth', 'NewOwner', { newOwner: '0x456' }),
    ]

    const { container } = render(<MobileExpandedEvents events={events} />)

    // Check that both events are rendered (not de-duped by React)
    expect(screen.getAllByText('Event')).toHaveLength(2)

    // Check that keys are unique by ensuring no duplicate key warnings
    const divs = container.querySelectorAll('.pl-4.border-l-2.border-border')
    expect(divs).toHaveLength(2)
  })

  it('should render empty fragment when events array is empty', () => {
    const { container } = render(<MobileExpandedEvents events={[]} />)

    // Should not render any event containers
    const eventContainers = container.querySelectorAll(
      '.pl-4.border-l-2.border-border',
    )
    expect(eventContainers).toHaveLength(0)
  })

  it('should handle events with different address fields', () => {
    const events = [
      createMockEvent('event1', 'Transfer', { owner: '0x111' }),
      createMockEvent('event2', 'NameRegistered', { registrant: '0x222' }),
      createMockEvent('event3', 'NameTransferred', { newOwner: '0x333' }),
    ]

    render(<MobileExpandedEvents events={events} />)

    const addresses = screen.getAllByTestId('address-display')
    expect(addresses).toHaveLength(3)
    expect(addresses[0]).toHaveTextContent('0x111')
    expect(addresses[1]).toHaveTextContent('0x222')
    expect(addresses[2]).toHaveTextContent('0x333')
  })
})
