import { SearchField } from './SearchField'

export default {
  Default: (
    <SearchField
      onSearch={(query) => console.log('Searching for:', query)}
      placeholder="Search domains..."
    />
  ),

  WithValue: (
    <SearchField
      defaultValue="erni"
      onSearch={(query) => console.log('Searching for:', query)}
      placeholder="Search domains..."
    />
  ),

  LikeImage: (
    <div className="max-w-lg">
      <SearchField
        defaultValue="erni"
        onChange={(e) => console.log('Input changed:', e.target.value)}
        onSearch={(query) => console.log('Searching for:', query)}
      />
    </div>
  ),

  Disabled: (
    <SearchField
      disabled={true}
      onSearch={(query) => console.log('Searching for:', query)}
      placeholder="Search disabled..."
    />
  ),

  Interactive: (
    <div className="max-w-md">
      <h3 className="mb-4 font-semibold text-lg">Domain Search</h3>
      <SearchField
        onSearch={(query) => {
          console.log('Searching for:', query)
          alert(`Searching for: ${query}`)
        }}
        placeholder="Enter domain name..."
      />
    </div>
  ),

  MobileLayout: (
    <div className="mx-auto max-w-sm bg-white p-4">
      <div className="mb-6">
        <h1 className="mb-2 font-bold text-2xl">Find your digital identity</h1>
        <p className="mb-4 text-gray-600 text-sm">
          Register a .eth domain name to secure your web3 username, store your
          crypto addresses, and more.
        </p>
      </div>

      <SearchField
        defaultValue="erni"
        onChange={(e) => console.log('Typing:', e.target.value)}
        onSearch={(query) => alert(`Searching for: ${query}`)}
      />
    </div>
  ),

  FullWidth: (
    <div className="w-full max-w-2xl">
      <SearchField
        onSearch={(query) => console.log('Full width search:', query)}
        placeholder="Search for the perfect domain name..."
      />
    </div>
  ),

  WithHandlers: (
    <div className="max-w-lg space-y-4">
      <h3 className="font-semibold text-lg">Search with All Handlers</h3>
      <SearchField
        onChange={(e) => {
          console.log('Input changed:', e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            const target = e.target as HTMLInputElement
            target.value = ''
            console.log('Cleared input')
          }
        }}
        onSearch={(query) => {
          console.log('Search triggered:', query)
          alert(`Search: ${query}`)
        }}
        placeholder="Type and press Enter or click search..."
      />
      <p className="text-gray-600 text-sm">
        Try typing, pressing Enter, clicking the mic (logs to console), or
        clicking search
      </p>
    </div>
  ),

  RealWorldExample: (
    <div className="mx-auto w-full max-w-4xl py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-4 font-bold text-4xl">
          Your Web3 Identity Starts Here
        </h1>
        <p className="mb-8 text-muted-foreground text-xl">
          Search for the perfect .eth domain name
        </p>
      </div>

      <SearchField
        onSearch={(query) => {
          console.log('Real world search:', query)
          // In a real app, this would trigger domain availability checking
        }}
        placeholder="Enter your dream domain name"
      />

      <div className="mt-6 text-center">
        <p className="text-muted-foreground text-sm">
          Popular searches: • blockchain.eth • nft.eth • dao.eth
        </p>
      </div>
    </div>
  ),
}
