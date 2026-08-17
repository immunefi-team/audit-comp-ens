import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { SearchForm } from './SearchForm'

const meta = {
  title: 'Organisms/SearchForm',
  component: SearchForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    loading: {
      control: 'boolean',
    },
    showRecentSearches: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof SearchForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Search for ENS domains...',
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const Loading: Story = {
  args: {
    loading: true,
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const WithRecentSearches: Story = {
  args: {
    recentSearches: ['example.eth', 'test.eth', 'myname.eth'],
    onSearch: (query) => console.log('Searching for:', query),
    onRecentSearchSelect: (query: string) =>
      console.log('Selected recent search:', query),
  },
}

// @ts-expect-error - TODO: Fix args
export const Interactive: Story = {
  render: () => (
    <div className="max-w-2xl">
      <h2 className="mb-6 font-bold text-2xl">Find Your Perfect Domain</h2>
      <SearchForm
        onSearch={(query) => {
          console.log('Searching for:', query)
          alert(`Starting search for: ${query}`)
        }}
        placeholder="Enter your desired domain name"
      />
      <p className="mt-4 text-muted-foreground text-sm">
        Search for .eth domains to check availability and pricing
      </p>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const FullFeatured: Story = {
  render: () => (
    <div className="max-w-2xl">
      <SearchForm
        loading={false}
        onRecentSearchSelect={(query: string) => {
          console.log('Using recent search:', query)
        }}
        onSearch={(query) => {
          console.log('Full search for:', query)
          setTimeout(() => {
            console.log('Search completed for:', query)
          }, 2000)
        }}
        placeholder="Search domains..."
        recentSearches={['alice.eth', 'bob.eth', 'crypto.eth', 'web3.eth']}
      />
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const MobileView: Story = {
  render: () => (
    <div className="max-w-sm">
      <SearchForm
        onSearch={(query) => console.log('Mobile search:', query)}
        placeholder="Search..."
      />
    </div>
  ),
}

export const WithoutRecentSearches: Story = {
  args: {
    placeholder: 'Find domains...',
    showRecentSearches: false,
    onSearch: (query) => console.log('No recent searches:', query),
  },
}

// @ts-expect-error - TODO: Fix args
export const RealWorldExample: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-4xl py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-4 font-bold text-4xl">
          Your Web3 Identity Starts Here
        </h1>
        <p className="mb-8 text-muted-foreground text-xl">
          Search for the perfect .eth domain name
        </p>
      </div>

      <SearchForm
        onRecentSearchSelect={(query: string) => {
          console.log('Recent search selected:', query)
        }}
        onSearch={(query) => {
          console.log('Real world search:', query)
        }}
        placeholder="Enter your dream domain name"
        recentSearches={['vitalik.eth', 'ethereum.eth', 'defi.eth']}
      />

      <div className="mt-6 text-center">
        <p className="text-muted-foreground text-sm">
          Popular searches: • blockchain.eth • nft.eth • dao.eth
        </p>
      </div>
    </div>
  ),
}
