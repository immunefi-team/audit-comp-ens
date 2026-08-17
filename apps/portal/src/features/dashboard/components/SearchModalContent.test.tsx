import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from '@/components/ui/command'
import { SearchModalContent } from './SearchModalContent'

const mockNavigateToName = vi.fn()
const mockNavigateToAddress = vi.fn()
const mockNavigateToResolver = vi.fn()
const mockOnSelectSuggestion = vi.fn()
const mockOnSelectOwnedName = vi.fn()
const mockOnSelectAvailableName = vi.fn()

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

let connectedAddressOverride: string | undefined
vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useConnection: () => ({ address: connectedAddressOverride }),
  }
})

vi.mock('../hooks/useSuggestionTlds', () => ({
  useSuggestionTlds: () => ({ validTlds: ['eth'], isLoading: false }),
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <div data-testid="name-avatar">{name}</div>
  ),
}))

const mockBuildSearchSuggestions = vi.fn()
vi.mock('../utils/buildSearchSuggestions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/buildSearchSuggestions')>()),
  buildSearchSuggestions: (opts: { value: string }) =>
    mockBuildSearchSuggestions(opts),
}))

// Avoid loading wagmi-dependent hooks in tests
vi.mock('@/features/profile/hooks/useEnsOwner', () => ({
  getEnsOwnerQueryOptions: (params: { name: string }) => ({
    queryKey: ['get-ens-owner', params],
    queryFn: () => Promise.resolve(null),
  }),
}))
let availabilityOverride: { isAvailable: boolean; name: string } | null = null
vi.mock('@/features/profile/hooks/useNameAvailability', () => ({
  getNameAvailabilityQueryOptions: (params: { name: string }) => ({
    queryKey: ['check-name-availability', params],
    queryFn: () =>
      Promise.resolve(
        availabilityOverride ?? { isAvailable: false, name: params.name },
      ),
  }),
}))
vi.mock('../hooks/useV1NamesForAddress', () => ({
  getV1NamesForAddressQueryOptions: (params: { address: string }) => ({
    queryKey: ['get-v1-names-for-address', params],
    queryFn: () => Promise.resolve([]),
  }),
}))
let ownedNamesOverride: { name: string }[] | null = null
vi.mock('../hooks/useV2NamesForAddress', () => ({
  getV2NamesForAddressQueryOptions: (params: { address: string }) => ({
    queryKey: ['get-v2-names-for-address', params],
    queryFn: () => Promise.resolve(ownedNamesOverride ?? []),
  }),
}))
vi.mock('@/hooks/useSupportsInterfaces', () => ({
  getSupportsInterfacesQueryOptions: (params: { address: string }) => ({
    queryKey: ['supported-interfaces', params],
    queryFn: () => Promise.resolve([]),
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Command>{children}</Command>
      </QueryClientProvider>
    )
  }
}

describe('SearchModalContent', () => {
  beforeEach(() => {
    mockNavigateToName.mockClear()
    mockNavigateToAddress.mockClear()
    mockNavigateToResolver.mockClear()
    mockOnSelectSuggestion.mockClear()
    mockOnSelectOwnedName.mockClear()
    mockOnSelectAvailableName.mockClear()
    connectedAddressOverride = undefined
    ownedNamesOverride = null
    mockBuildSearchSuggestions.mockImplementation(
      ({ value }: { value: string }) => {
        if (!value.trim()) return []
        return [
          {
            id: 'name:foo.eth',
            label: 'foo.eth',
            description: 'View ENS name details',
            inputValue: 'foo.eth',
            action: () => mockNavigateToName('foo.eth'),
          },
        ]
      },
    )
  })

  it('shows empty state when search is empty', () => {
    render(
      <SearchModalContent
        searchValue=""
        onSelectSuggestion={mockOnSelectSuggestion}
        onSelectOwnedName={mockOnSelectOwnedName}
        navigateToName={mockNavigateToName}
        navigateToAddress={mockNavigateToAddress}
        navigateToResolver={mockNavigateToResolver}
      />,
      { wrapper: createWrapper() },
    )

    expect(
      screen.getByText('Type to search for names or addresses...'),
    ).toBeInTheDocument()
  })

  it('shows no results message when search has no matches', () => {
    mockBuildSearchSuggestions.mockReturnValue([])

    render(
      <SearchModalContent
        searchValue="xyznonexistent"
        onSelectSuggestion={mockOnSelectSuggestion}
        navigateToName={mockNavigateToName}
        navigateToAddress={mockNavigateToAddress}
        navigateToResolver={mockNavigateToResolver}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('No results found.')).toBeInTheDocument()
  })

  it('shows Suggestions group when buildSearchSuggestions returns items', async () => {
    render(
      <SearchModalContent
        searchValue="foo"
        onSelectSuggestion={mockOnSelectSuggestion}
        navigateToName={mockNavigateToName}
        navigateToAddress={mockNavigateToAddress}
        navigateToResolver={mockNavigateToResolver}
      />,
      { wrapper: createWrapper() },
    )

    await vi.waitFor(() => {
      expect(
        screen.getByRole('group', { name: 'Suggestions' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('foo.eth')).toBeInTheDocument()
  })

  it('calls onSelectSuggestion when a suggestion is selected', async () => {
    const user = userEvent.setup()

    render(
      <SearchModalContent
        searchValue="foo"
        onSelectSuggestion={mockOnSelectSuggestion}
        navigateToName={mockNavigateToName}
        navigateToAddress={mockNavigateToAddress}
        navigateToResolver={mockNavigateToResolver}
      />,
      { wrapper: createWrapper() },
    )

    await vi.waitFor(() => {
      expect(screen.getByText('foo.eth')).toBeInTheDocument()
    })

    await user.click(screen.getByText('foo.eth'))

    expect(mockOnSelectSuggestion).toHaveBeenCalledTimes(1)
    expect(mockOnSelectSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'name:foo.eth',
        inputValue: 'foo.eth',
      }),
    )
  })

  it('shows "Available to register" as description on a suggestion when the name is available', async () => {
    mockBuildSearchSuggestions.mockReturnValue([
      {
        id: 'name:new.eth',
        label: 'new.eth',
        description: 'View ENS name details',
        inputValue: 'new.eth',
        action: () => mockNavigateToName('new.eth'),
      },
    ])
    availabilityOverride = { isAvailable: true, name: 'new.eth' }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['get-ens-owner', { name: 'new.eth' }], null)

    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <Command>
          <SearchModalContent
            searchValue="new"
            onSelectSuggestion={mockOnSelectSuggestion}
            navigateToName={mockNavigateToName}
            navigateToAddress={mockNavigateToAddress}
            navigateToResolver={mockNavigateToResolver}
          />
        </Command>
      </QueryClientProvider>,
    )

    const availableItem = await screen.findByRole('option', {
      name: /new\.eth.*Available to register/,
    })
    expect(availableItem).toHaveAttribute('data-value', 'name:new.eth')
    await user.click(availableItem)
    expect(mockOnSelectSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'name:new.eth', inputValue: 'new.eth' }),
    )
    availabilityOverride = null
  })

  it('calls onSelectAvailableName when an available name is selected and callback is provided', async () => {
    mockBuildSearchSuggestions.mockReturnValue([
      {
        id: 'name:new.eth',
        label: 'new.eth',
        description: 'View ENS name details',
        inputValue: 'new.eth',
        action: () => mockNavigateToName('new.eth'),
      },
    ])
    availabilityOverride = { isAvailable: true, name: 'new.eth' }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['get-ens-owner', { name: 'new.eth' }], null)

    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <Command>
          <SearchModalContent
            searchValue="new"
            onSelectSuggestion={mockOnSelectSuggestion}
            onSelectAvailableName={mockOnSelectAvailableName}
            navigateToName={mockNavigateToName}
            navigateToAddress={mockNavigateToAddress}
            navigateToResolver={mockNavigateToResolver}
          />
        </Command>
      </QueryClientProvider>,
    )

    const availableItem = await screen.findByRole('option', {
      name: /new\.eth.*Available to register/,
    })
    await user.click(availableItem)

    expect(mockOnSelectAvailableName).toHaveBeenCalledTimes(1)
    expect(mockOnSelectAvailableName).toHaveBeenCalledWith('new.eth')
    expect(mockOnSelectSuggestion).not.toHaveBeenCalled()
    availabilityOverride = null
  })

  it('passes searchValue and validTlds into buildSearchSuggestions', () => {
    render(
      <SearchModalContent
        searchValue="  bar  "
        onSelectSuggestion={mockOnSelectSuggestion}
        navigateToName={mockNavigateToName}
        navigateToAddress={mockNavigateToAddress}
        navigateToResolver={mockNavigateToResolver}
      />,
      { wrapper: createWrapper() },
    )

    expect(mockBuildSearchSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '  bar  ',
        validTlds: ['eth'],
      }),
    )
  })

  it('shows owned name only in Names you own, not in Suggestions', async () => {
    connectedAddressOverride = '0x7Bc153b2a4C8a2f3428bd0da77a901b81c6dD809'
    ownedNamesOverride = [{ name: 'foo.eth' }]
    mockBuildSearchSuggestions.mockReturnValue([
      {
        id: 'name:foo.eth',
        label: 'foo.eth',
        description: 'View ENS name details',
        inputValue: 'foo.eth',
        action: () => mockNavigateToName('foo.eth'),
      },
    ])

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <Command>
          <SearchModalContent
            searchValue="foo"
            onSelectSuggestion={mockOnSelectSuggestion}
            onSelectOwnedName={mockOnSelectOwnedName}
            navigateToName={mockNavigateToName}
            navigateToAddress={mockNavigateToAddress}
            navigateToResolver={mockNavigateToResolver}
          />
        </Command>
      </QueryClientProvider>,
    )

    await vi.waitFor(() => {
      expect(
        screen.getByRole('group', { name: 'Names you own' }),
      ).toBeInTheDocument()
    })
    const optionsWithFoo = screen
      .getAllByRole('option')
      .filter((el) => el.textContent?.includes('foo.eth'))
    expect(optionsWithFoo).toHaveLength(1)
    expect(optionsWithFoo[0]).toHaveAttribute('data-value', 'owned:foo.eth')
  })
})
