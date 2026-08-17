import { screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@/utils/test-utils'
import { NotificationsDropdown } from './notification-dropdown'

const mockUseInfiniteQuery = vi.fn()

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useInfiniteQuery: () => mockUseInfiniteQuery(),
}))

vi.mock('@/features/notifications/data/queries/notifications', () => ({
  notificationsInfiniteQuery: {},
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('@/features/notifications/inbox/notification-item', () => ({
  NotificationItem: ({ notification }: { notification: { kind: string } }) => (
    <div data-testid="notification-item">{notification.kind}</div>
  ),
}))

vi.mock('@/features/notifications/inbox/unread-count', () => ({
  UnreadCount: () => <div>0</div>,
}))

describe('NotificationsDropdown', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReset()
  })

  it('shows loading state', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    const { container } = render(<NotificationsDropdown />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows error state', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<NotificationsDropdown />)
    expect(screen.getByText('Failed to load notifications')).toBeTruthy()
  })

  it('shows top 3 renderable notifications when available', () => {
    const validExpiryPayload = {
      name: 'example.eth',
      expiryDate: Date.now() + 1_000_000,
      isOwner: true,
      watchReason: 'owned',
    }

    mockUseInfiniteQuery.mockReturnValue({
      data: [
        {
          id: '1',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
        {
          id: '2',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
        {
          id: '3',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
        {
          id: '4',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
        {
          id: '5',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
        {
          id: '6',
          kind: 'name-expiry',
          payload: validExpiryPayload,
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        },
      ],
      isLoading: false,
      isError: false,
    })

    render(<NotificationsDropdown />)
    expect(screen.getAllByTestId('notification-item')).toHaveLength(3)
  })

  it('renders query-selected notifications', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: [
        {
          id: '1',
          kind: 'ens-update',
          payload: { title: 'Good', summary: 'Summary' },
          source: 'broadcast',
          seen: false,
          timestamp: Date.now(),
        },
      ],
      isLoading: false,
      isError: false,
    })

    render(<NotificationsDropdown />)
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1)
  })

  it('shows empty state when no renderable notifications exist', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })

    render(<NotificationsDropdown />)
    expect(screen.getByText('Nothing here yet!')).toBeTruthy()
  })
})
