import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Route } from './index'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: ({ select }: { select: (params: { name: string }) => string }) =>
      select({ name: 'example.eth' }),
    useLoaderData: ({
      select,
    }: {
      select: (data: { fallback: undefined }) => undefined
    }) => select({ fallback: undefined }),
  }),
  redirect: (options: unknown) => ({ options }),
}))

vi.mock('@/features/profile/service/profileExpiry', () => ({
  profileExpiryQuery: vi.fn(),
}))

vi.mock('@/features/profile/service/profileOwner', () => ({
  profileOwnerQuery: vi.fn(),
}))

vi.mock('@/features/profile/service/profileRecords', () => ({
  profileRecordsQuery: vi.fn(),
}))

vi.mock('@/features/profile/service/profileRegistration', () => ({
  profileRegistrationQuery: vi.fn(),
}))

vi.mock('@/features/profile/service/profileReverseName', () => ({
  profileReverseNameQuery: vi.fn(),
}))

vi.mock('@/features/profile/components/view/ProfileView', () => ({
  ProfileView: ({ name }: { name: string }) => (
    <div data-testid="profile-view">{name}</div>
  ),
}))

vi.mock('@/features/profile/components/view/ProfileLoading', () => ({
  ProfileLoading: ({ name }: { name: string }) => (
    <div data-testid="profile-loading">{name}</div>
  ),
}))

const renderRouteOption = (option: 'component' | 'pendingComponent') => {
  const Component = Route.options[option] as ComponentType
  return render(<Component />)
}

describe('/$name client-rendered profile route', () => {
  it('keeps the profile page and its data client-rendered', () => {
    expect(Route.options.ssr).toBe(false)
  })

  it('always renders the canonical profile view', () => {
    renderRouteOption('component')

    expect(screen.getByTestId('profile-view').textContent).toBe('example.eth')
  })

  it('always renders the canonical profile loading state while pending', () => {
    renderRouteOption('pendingComponent')

    expect(screen.getByTestId('profile-loading').textContent).toBe(
      'example.eth',
    )
  })
})
