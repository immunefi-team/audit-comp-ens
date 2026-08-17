import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HomeSearchInput } from './HomeSearchInput'

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useConnection: () => ({ address: undefined }),
  }
})

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(),
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebouncedValue: (value: string) => value,
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: ({ name }: { name: string }) => (
    <div data-testid="name-avatar">{name}</div>
  ),
}))

vi.mock('@/features/profile/hooks/useEnsOwner', () => ({
  getEnsOwnerQueryOptions: ({ name }: { name: string }) => ({
    queryKey: ['get-ens-owner', { name }],
    queryFn: async () => ({
      owner: '0x1234567890abcdef1234567890abcdef12345678',
      registryAddress: '0x0000000000000000000000000000000000000000',
      network: 'sepolia',
    }),
  }),
}))

const { useIsMobile } = await import('@/hooks/use-mobile')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

/** Helper to focus the search input (inline popover opens when typing) */
async function openSearchDialog(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByPlaceholderText('Search...')
  await user.click(input)
  return input
}

describe('HomeSearchInput', () => {
  describe('Address Suggestions', () => {
    it('should truncate address label on mobile', async () => {
      vi.mocked(useIsMobile).mockReturnValue(true)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, '0x205d2686da3bf33f64c17f21462c51b5ead462cf')

      await waitFor(() => {
        // Should show truncated address: "0x205d...62CF"
        expect(screen.getByText(/0x205d.*62CF/)).toBeInTheDocument()
        // Should NOT show full address
        expect(
          screen.queryByText('0x205d2686da3bf33f64c17f21462c51b5ead462cf'),
        ).not.toBeInTheDocument()
      })
    })

    it('should show full address label on desktop', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, '0x205d2686da3bf33f64c17f21462c51b5ead462cf')

      await waitFor(() => {
        // Should show full checksummed address
        expect(
          screen.getByText('0x205d2686da3Bf33f64C17f21462c51B5eaD462CF'),
        ).toBeInTheDocument()
      })
    })

    it('should create address suggestion with correct format', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, '0x205d2686da3bf33f64c17f21462c51b5ead462cf')

      await waitFor(() => {
        // Should show checksum address (note: mixed case due to EIP-55 checksumming)
        expect(
          screen.getByText('0x205d2686da3Bf33f64C17f21462c51B5eaD462CF'),
        ).toBeInTheDocument()
        // Should show description
        expect(screen.getByText('View address details')).toBeInTheDocument()
      })
    })
  })

  describe('ENS Name Suggestions', () => {
    it('should NOT truncate normal ENS names on mobile', async () => {
      vi.mocked(useIsMobile).mockReturnValue(true)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, 'vitalik.eth')

      await waitFor(() => {
        // Should show full name (not truncated)
        expect(
          screen.getAllByText('vitalik.eth').length,
        ).toBeGreaterThanOrEqual(1)
      })
    })

    it('should NOT truncate ENS names starting with 0x but not being addresses on mobile', async () => {
      vi.mocked(useIsMobile).mockReturnValue(true)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      // Type a name that starts with "0x" but is too short to be an address
      await user.type(input, '0xdev')

      await waitFor(() => {
        // Should show full name, NOT truncated (only 5 chars, not 42)
        expect(screen.getAllByText('0xdev.eth').length).toBeGreaterThanOrEqual(
          1,
        )
        expect(screen.queryByText(/0xde…/)).not.toBeInTheDocument()
      })
    })

    it('should show .eth (and valid TLD) suggestions for simple names', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, 'vitalik')

      await waitFor(() => {
        // Should show .eth version (multi-TLD suggestions show label.tld)
        // "vitalik.eth" appears in NameAvatar mock and in the suggestion label
        expect(
          screen.getAllByText('vitalik.eth').length,
        ).toBeGreaterThanOrEqual(1)
        expect(
          screen.getAllByText('View ENS name details').length,
        ).toBeGreaterThanOrEqual(1)
      })
    })

    it('should create ENS name suggestion with correct format', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, 'nick.eth')

      await waitFor(() => {
        // Should show ENS name
        expect(screen.getAllByText('nick.eth').length).toBeGreaterThanOrEqual(1)
        // Should show description (one per suggestion row)
        expect(
          screen.getAllByText('View ENS name details').length,
        ).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Suggestion List Behavior', () => {
    it('should show ONLY address suggestion (not ENS name) for valid addresses', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, '0x205d2686da3bf33f64c17f21462c51b5ead462cf')

      await waitFor(() => {
        // Should show address suggestion
        expect(screen.getByText('View address details')).toBeInTheDocument()
        // Should NOT show ENS name suggestion
        expect(
          screen.queryByText('View ENS name details'),
        ).not.toBeInTheDocument()
      })
    })

    it('should not show suggestions when input is empty', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      // Open the search modal (Cmd+K / Ctrl+K) to see empty state
      await user.keyboard('{Control>}k{/Control}')

      await waitFor(() => {
        expect(
          screen.getByText('Type to search for names or addresses...'),
        ).toBeInTheDocument()
      })
      expect(screen.queryByText('View address details')).not.toBeInTheDocument()
      expect(
        screen.queryByText('View ENS name details'),
      ).not.toBeInTheDocument()
    })

    it('should update suggestions when input changes', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, 'vitalik')

      await waitFor(() => {
        expect(
          screen.getAllByText('vitalik.eth').length,
        ).toBeGreaterThanOrEqual(1)
      })

      // Clear and type new value
      await user.clear(input)
      await user.type(input, 'nick')

      await waitFor(() => {
        expect(screen.getAllByText('nick.eth').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('vitalik.eth')).not.toBeInTheDocument()
      })
    })

    it('should clear the input when an item is selected', async () => {
      vi.mocked(useIsMobile).mockReturnValue(false)
      const user = userEvent.setup()

      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const input = await openSearchDialog(user)
      await user.type(input, 'vitalik')

      await waitFor(() => {
        expect(
          screen.getAllByText('vitalik.eth').length,
        ).toBeGreaterThanOrEqual(1)
      })

      await user.click(screen.getAllByText('vitalik.eth')[0])

      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })
  })

  describe('Mobile vs Desktop Consistency', () => {
    it('should show only address suggestion for addresses on both mobile and desktop', async () => {
      const testAddress = '0x205d2686da3bf33f64c17f21462c51b5ead462cf'
      const user = userEvent.setup()

      // Test mobile
      vi.mocked(useIsMobile).mockReturnValue(true)
      const { unmount } = render(<HomeSearchInput />, {
        wrapper: createWrapper(),
      })

      const input = await openSearchDialog(user)
      await user.type(input, testAddress)

      await waitFor(() => {
        expect(screen.getByText('View address details')).toBeInTheDocument()
        expect(
          screen.queryByText('View ENS name details'),
        ).not.toBeInTheDocument()
      })

      unmount()

      // Test desktop
      vi.mocked(useIsMobile).mockReturnValue(false)
      render(<HomeSearchInput />, { wrapper: createWrapper() })

      const desktopInput = await openSearchDialog(user)
      await user.type(desktopInput, testAddress)

      await waitFor(() => {
        // Same descriptions should appear - only address
        expect(screen.getByText('View address details')).toBeInTheDocument()
        expect(
          screen.queryByText('View ENS name details'),
        ).not.toBeInTheDocument()
      })
    })
  })
})
