import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@/utils/test-utils'
import { NotificationItem } from './notification-item'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

describe('NotificationItem', () => {
  it('renders known notification with valid payload', () => {
    const { getByText } = render(
      <NotificationItem
        notification={{
          id: '1',
          kind: 'name-expiry',
          payload: {
            name: 'example.eth',
            expiryDate: Date.now() + 1_000_000,
            isOwner: true,
            watchReason: 'owned',
          },
          source: 'personal',
          seen: false,
          timestamp: Date.now(),
        }}
      />,
    )

    expect(getByText('example.eth')).toBeInTheDocument()
  })

  it('renders when kind exists (payload validation handled in query select)', () => {
    const { container } = render(
      <NotificationItem
        notification={
          {
            id: '2',
            kind: 'ens-update',
            payload: {
              title: 'ENS Policy Update',
              summary: 123,
            },
            source: 'broadcast',
            seen: false,
            timestamp: Date.now(),
          } as unknown as Parameters<typeof NotificationItem>[0]['notification']
        }
      />,
    )

    expect(container.querySelector('.border-b')).not.toBeNull()
  })

  it('returns null for unknown kinds', () => {
    const { container } = render(
      <NotificationItem
        notification={
          {
            id: '3',
            kind: 'future-kind',
            payload: {},
            source: 'personal',
            seen: false,
            timestamp: Date.now(),
          } as unknown as Parameters<typeof NotificationItem>[0]['notification']
        }
      />,
    )

    expect(container.querySelector('.border-b')).toBeNull()
  })
})
