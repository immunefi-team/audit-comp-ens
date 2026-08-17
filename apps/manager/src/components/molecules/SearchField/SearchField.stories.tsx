import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import {
  getByteLength,
  MAX_DOMAIN_BYTES,
  truncateToMaxBytes,
} from '@/utils/domain'
import { SearchField } from './SearchField'

const meta = {
  title: 'Molecules/SearchField',
  component: SearchField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // size: {
    //   control: 'select',
    //   options: ['sm', 'default', 'lg'],
    // },
    disabled: {
      control: 'boolean',
    },
    // showSearchIcon: {
    //   control: 'boolean',
    // },
  },
} satisfies Meta<typeof SearchField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Search for domains...',
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const WithValue: Story = {
  args: {
    placeholder: 'Search for domains...',
    defaultValue: 'example',
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const WithoutIcon: Story = {
  args: {
    placeholder: 'Search for domains...',
    // showSearchIcon: false,
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const CustomSearchIcon: Story = {
  args: {
    placeholder: 'Search for domains...',
    // searchIconElement: <span>🔍</span>,
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Search for domains...',
    disabled: true,
    onSearch: (query) => console.log('Searching for:', query),
  },
}

export const CustomButton: Story = {
  args: {
    placeholder: 'Search for domains...',
    // buttonText: 'Find',
    // buttonProps: { variant: 'secondary' },
    onSearch: (query) => console.log('Finding:', query),
  },
}

export const DifferentSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <SearchField
        onSearch={(query) => console.log('Small search:', query)}
        // size="sm"
        // buttonProps={{ size: 'sm' }}
        placeholder="Small search field..."
      />
      <SearchField
        onSearch={(query) => console.log('Default search:', query)}
        // size="default"
        placeholder="Default search field..."
      />
      <SearchField
        onSearch={(query) => console.log('Large search:', query)}
        // size="lg"
        // buttonProps={{ size: 'lg' }}
        placeholder="Large search field..."
      />
    </div>
  ),
}

export const Interactive: Story = {
  render: () => (
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
}

export const FormIntegration: Story = {
  render: () => (
    <div className="max-w-lg space-y-4">
      <h3 className="font-semibold text-lg">ENS Domain Search</h3>
      <SearchField
        onSearch={(query) => {
          console.log('Searching for domains:', query)
          setTimeout(() => {
            console.log('Search results for:', query)
          }, 1000)
        }}
        // buttonText="Check Availability"
        // buttonProps={{ variant: 'default' }}
        placeholder="Search for available domains..."
      />
      <p className="text-gray-600 text-sm">
        Search for .eth domains to check availability and pricing
      </p>
    </div>
  ),
}

export const WithValidation: Story = {
  args: {
    placeholder: 'Enter domain name...',
    // helperText: 'Enter a valid domain name (e.g., example.eth)',
    onSearch: (query) => {
      if (query.length < 3) {
        alert('Domain name must be at least 3 characters')
        return
      }
      console.log('Valid search:', query)
    },
  },
}

export const CustomStyling: Story = {
  args: {
    placeholder: 'Custom styled search...',
    className: 'max-w-xl',
    // buttonText: 'GO',
    // buttonProps: {
    //   variant: 'destructive',
    //   className: 'px-8',
    // },
    onSearch: (query) => console.log('Custom search:', query),
  },
}

// Multi-byte character testing stories
export const MultiByteCharacterInput: Story = {
  render: () => {
    const [value, setValue] = useState('')
    const truncated = truncateToMaxBytes(value)
    const byteLen = getByteLength(truncated)
    const charLen = truncated.length

    return (
      <div className="max-w-md space-y-4">
        <SearchField
          onChange={(e) => setValue(e.target.value)}
          onSearch={(query) =>
            console.log('Searched:', query, 'Bytes:', getByteLength(query))
          }
          placeholder="Try emojis, Chinese, or mixed characters..."
          value={truncated}
        />
        <div className="space-y-1 rounded-md bg-slate-100 p-3 text-gray-700 text-sm">
          <p>
            <strong>Input:</strong> {truncated || '(empty)'}
          </p>
          <p>
            <strong>Byte length:</strong> {byteLen} / {MAX_DOMAIN_BYTES}
          </p>
          <p>
            <strong>Character count:</strong> {charLen}
          </p>
          <p className="text-gray-500 text-xs">
            {byteLen > MAX_DOMAIN_BYTES
              ? '⚠️ Exceeds limit, will be truncated'
              : '✓ Within limit'}
          </p>
        </div>
        <div className="space-y-2 text-gray-600 text-xs">
          <p>
            <strong>Try these examples:</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Emojis: 😀🎉🎊🎈🎁</li>
            <li>Chinese: 中国日本韓国</li>
            <li>Arabic: مرحبا</li>
            <li>Mixed: café😀中国test</li>
          </ul>
        </div>
      </div>
    )
  },
}

export const EmojiInput: Story = {
  render: () => {
    const [value, setValue] = useState('')
    const byteLen = getByteLength(value)

    const emojiExamples = [
      { label: 'Faces', emojis: '😀😃😄😁😅😂🤣' },
      { label: 'Hearts', emojis: '❤️💛💚💙💜🖤🤍' },
      { label: 'Animals', emojis: '🐶🐱🐭🐹🐰🦊🐻' },
      { label: 'Food', emojis: '🍕🍔🍟🌭🍿🥓🥚' },
      { label: 'Flags', emojis: '🇺🇸🇬🇧🇨🇳🇯🇵🇰🇷🇫🇷🇩🇪' },
    ]

    return (
      <div className="max-w-md space-y-4">
        <SearchField
          onChange={(e) => setValue(truncateToMaxBytes(e.target.value))}
          onSearch={(query) => console.log('Emoji search:', query)}
          placeholder="Enter emoji domains..."
          value={value}
        />
        <div className="space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          <p>
            <strong>Bytes:</strong> {byteLen} / {MAX_DOMAIN_BYTES}
          </p>
          <p>
            <strong>Characters:</strong> {value.length}
          </p>
          <p className="text-gray-500 text-xs">
            Most emojis = 4 bytes each (max ~63 emojis)
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-sm">Quick add:</p>
          {emojiExamples.map((ex) => (
            <button
              className="mr-2 rounded bg-blue-100 px-2 py-1 text-sm hover:bg-blue-200"
              key={ex.label}
              onClick={() =>
                setValue((prev) => truncateToMaxBytes(prev + ex.emojis))
              }
              type="button"
            >
              {ex.label}: {ex.emojis}
            </button>
          ))}
        </div>
      </div>
    )
  },
}

export const TruncationBoundary: Story = {
  render: () => {
    const testString = '😀'.repeat(70) // 280 bytes, exceeds 255
    const truncated = truncateToMaxBytes(testString)
    const [input, setInput] = useState(truncated)

    return (
      <div className="max-w-md space-y-4">
        <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-4">
          <p className="font-semibold text-sm text-yellow-800">
            Truncation Boundary Test
          </p>
          <div className="space-y-1 text-sm text-yellow-900">
            <p>
              <strong>Original:</strong> 70 emojis = {getByteLength(testString)}{' '}
              bytes
            </p>
            <p>
              <strong>Truncated:</strong> {truncated.length} emojis ={' '}
              {getByteLength(truncated)} bytes
            </p>
            <p className="text-xs">
              Emoji at boundary is safely removed, not split
            </p>
          </div>
        </div>
        <SearchField
          onChange={(e) => setInput(truncateToMaxBytes(e.target.value))}
          onSearch={(q) => console.log('Search:', q)}
          placeholder="Pre-filled with max emojis..."
          value={input}
        />
        <div className="space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          <p>
            Current: {getByteLength(input)} bytes / {input.length} chars
          </p>
          <p className="text-gray-600 text-xs">
            Try pasting more text - it will truncate safely
          </p>
        </div>
      </div>
    )
  },
}

export const HighByteDensityInput: Story = {
  render: () => {
    const [value, setValue] = useState('')
    const byteLen = getByteLength(value)

    const examples = [
      { label: 'Chinese (3 bytes each)', text: '中国日本韓国印度泰国越南' },
      { label: 'Arabic (2-3 bytes each)', text: 'مرحبا بك في العالم' },
      { label: 'Hebrew (2 bytes each)', text: 'שלום עולם' },
      { label: 'Russian (2 bytes each)', text: 'Привет мир' },
    ]

    return (
      <div className="max-w-md space-y-4">
        <SearchField
          onChange={(e) => setValue(truncateToMaxBytes(e.target.value))}
          onSearch={(q) => console.log('Search:', q)}
          placeholder="Enter multi-byte characters..."
          value={value}
        />
        <div className="space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          <p>
            <strong>Bytes:</strong> {byteLen} / {MAX_DOMAIN_BYTES}
          </p>
          <p>
            <strong>Characters:</strong> {value.length}
          </p>
          <p className="text-gray-500 text-xs">
            Bytes per char:{' '}
            {value.length > 0 ? (byteLen / value.length).toFixed(2) : 'N/A'}
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-sm">Test with:</p>
          {examples.map((ex) => (
            <button
              className="mr-2 rounded bg-purple-100 px-3 py-1 text-sm hover:bg-purple-200"
              key={ex.label}
              onClick={() => setValue(truncateToMaxBytes(ex.text))}
              type="button"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    )
  },
}

export const MixedCharacterTypes: Story = {
  render: () => {
    const [value, setValue] = useState('test😀中国café')
    const byteLen = getByteLength(value)

    // Calculate byte breakdown
    const breakdown = value.split('').map((char) => ({
      char,
      bytes: getByteLength(char),
    }))

    return (
      <div className="max-w-md space-y-4">
        <SearchField
          onChange={(e) => setValue(truncateToMaxBytes(e.target.value))}
          onSearch={(q) => console.log('Search:', q)}
          placeholder="Mixed character types..."
          value={value}
        />
        <div className="space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          <p>
            <strong>Total bytes:</strong> {byteLen} / {MAX_DOMAIN_BYTES}
          </p>
          <p>
            <strong>Characters:</strong> {value.length}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 font-medium text-sm">Character breakdown:</p>
          <div className="flex flex-wrap gap-1">
            {breakdown.map((item, idx) => (
              <span
                className="rounded bg-slate-200 px-2 py-1 font-mono text-xs"
                // biome-ignore lint/suspicious/noArrayIndexKey: a character breakdown contains repeated characters at distinct positions, so the index is required for a stable unique key
                key={`${item.char}-${idx}-${item.bytes}`}
                title={`${item.bytes} byte${item.bytes > 1 ? 's' : ''}`}
              >
                {item.char}
                <span className="ml-1 text-gray-500">({item.bytes})</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  },
}

export const TruncationEdgeCases: Story = {
  render: () => {
    const cases = [
      {
        name: '4-byte emoji at boundary',
        original: `${'a'.repeat(251)}😀`,
        description: 'Should truncate emoji (would be 255 bytes)',
      },
      {
        name: 'Chinese char at boundary',
        original: `${'a'.repeat(253)}中`,
        description: 'Should truncate Chinese char (would be 256 bytes)',
      },
      {
        name: 'High-density emoji',
        original: '😀'.repeat(70),
        description: '70 emojis = 280 bytes, should truncate to ~63',
      },
      {
        name: 'Mixed content overflow',
        original: `${'test'.repeat(30)}😀😀😀中国中国`,
        description: 'Mixed ASCII, emoji, and Chinese near limit',
      },
    ]

    return (
      <div className="space-y-6">
        <h3 className="font-semibold text-lg">Truncation Edge Cases</h3>
        {cases.map((testCase) => {
          const truncated = truncateToMaxBytes(testCase.original)
          const originalBytes = getByteLength(testCase.original)
          const truncatedBytes = getByteLength(truncated)

          return (
            <div
              className="space-y-2 rounded-md border p-4"
              key={testCase.name}
            >
              <p className="font-medium text-sm">{testCase.name}</p>
              <p className="text-gray-600 text-xs">{testCase.description}</p>
              <div className="space-y-1 rounded bg-slate-50 p-2 font-mono text-xs">
                <p>
                  <strong>Original:</strong> {originalBytes} bytes /{' '}
                  {testCase.original.length} chars
                </p>
                <p>
                  <strong>Truncated:</strong> {truncatedBytes} bytes /{' '}
                  {truncated.length} chars
                </p>
                <p className="break-all text-gray-600">
                  End: ...{truncated.slice(-20)}
                </p>
              </div>
              <div className="text-xs">
                {originalBytes > MAX_DOMAIN_BYTES ? (
                  <span className="text-green-600">
                    ✓ Successfully truncated to {truncatedBytes} bytes
                  </span>
                ) : (
                  <span className="text-blue-600">
                    ✓ Within limit, no truncation needed
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  },
}
