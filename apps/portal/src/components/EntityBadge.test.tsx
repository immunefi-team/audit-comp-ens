import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Address } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queryRef = vi.hoisted(() => ({
  current: { data: undefined as unknown, isLoading: false },
}))

const contractNameRef = vi.hoisted(() => ({
  current: undefined as string | undefined,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string
    params?: Record<string, string>
    children: React.ReactNode
    className?: string
  }) => (
    <a
      href={to}
      data-params={JSON.stringify(params)}
      className={className}
      data-testid="router-link"
    >
      {children}
    </a>
  ),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryRef.current,
}))

vi.mock('wagmi', () => ({
  useChainId: () => 1,
}))

vi.mock('@/features/profile/components/NameAvatar', () => ({
  NameAvatar: () => <span data-testid="avatar" />,
}))

vi.mock('@/hooks/useSupportsInterfaces', () => ({
  getSupportsInterfacesQueryOptions: () => ({
    queryKey: ['supports-interfaces-mock'],
    queryFn: async () => [false],
  }),
}))

vi.mock('@/utils/ens/ensContractNames', () => ({
  getEnsContractName: () => contractNameRef.current,
}))

// Reset shared mock state between tests so resolver / contractName overrides
// don't leak across cases.
beforeEach(() => {
  queryRef.current = { data: undefined, isLoading: false }
  contractNameRef.current = undefined
})

const { EntityBadge } = await import('./EntityBadge')

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address
const TEST_TX_URL = 'https://etherscan.io/tx/0xabc'

describe('EntityBadge primary action', () => {
  it('renders an internal Link for variant="name"', () => {
    render(
      <EntityBadge variant="name" name="alice.eth">
        alice-content
      </EntityBadge>,
    )
    // Disambiguate from the hover-chip Link by matching the wrapped content.
    const primary = screen.getByText('alice-content').closest('a')
    expect(primary).toHaveAttribute('href', '/$name')
    expect(primary?.dataset.params).toBe(JSON.stringify({ name: 'alice.eth' }))
  })

  it('renders an internal Link for variant="address"', () => {
    render(
      <EntityBadge variant="address" address={TEST_ADDRESS}>
        addr-content
      </EntityBadge>,
    )
    const primary = screen.getByText('addr-content').closest('a')
    expect(primary).toHaveAttribute('href', '/addr/$addr')
    expect(primary?.dataset.params).toBe(JSON.stringify({ addr: TEST_ADDRESS }))
  })

  it('renders an external anchor for variant="tx" with etherscanHref', () => {
    render(
      <EntityBadge variant="tx" etherscanHref={TEST_TX_URL}>
        0xabc
      </EntityBadge>,
    )
    // Primary action is a real <a target=_blank>, not a button/navigate.
    // There are two anchors in the DOM (chip + primary). The primary wraps the
    // content span, so find by the wrapped text.
    const anchors = screen.getAllByRole('link')
    const primary = anchors.find((a) => a.textContent?.includes('0xabc'))
    expect(primary).toBeDefined()
    expect(primary).toHaveAttribute('href', TEST_TX_URL)
    expect(primary).toHaveAttribute('target', '_blank')
    expect(primary).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders an external anchor for variant="contract" with etherscanHref (non-resolver)', () => {
    render(
      <EntityBadge
        variant="contract"
        address={TEST_ADDRESS}
        etherscanHref={TEST_TX_URL}
      >
        0x12...
      </EntityBadge>,
    )
    const anchors = screen.getAllByRole('link')
    const primary = anchors.find((a) => a.textContent?.includes('0x12...'))
    expect(primary).toHaveAttribute('href', TEST_TX_URL)
    expect(primary).toHaveAttribute('target', '_blank')
  })

  it('renders no clickable primary wrapper when nothing is actionable', () => {
    render(
      <EntityBadge variant="tx" copyValue="0xabc">
        tx-content
      </EntityBadge>,
    )
    // The primary wrapper for an un-actionable badge is a plain <div>, so the
    // wrapped content has no anchor or button ancestor.
    const content = screen.getByText('tx-content')
    expect(content.closest('a')).toBeNull()
    expect(content.closest('button')).toBeNull()
  })

  it('variant="default" has a non-interactive primary wrapper and renders no links even with chip-eligible props', () => {
    render(
      <EntityBadge
        variant="default"
        name="alice.eth"
        address={TEST_ADDRESS}
        etherscanHref={TEST_TX_URL}
      >
        default-content
      </EntityBadge>,
    )
    const content = screen.getByText('default-content')
    expect(content.closest('a')).toBeNull()
    expect(content.closest('button')).toBeNull()
    // No name/address/etherscan chips for the default variant.
    expect(screen.queryByTestId('router-link')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('variant="default" shows a Copy chip on hover when copyValue is set', () => {
    render(
      <EntityBadge variant="default" copyValue="0xabc">
        default-with-copy
      </EntityBadge>,
    )
    // A single Copy chip in the overlay (no name/address/etherscan chips).
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Copy')
  })

  it('variant="contract" + isResolver renders a Link to /resolver/$address (not Etherscan)', () => {
    queryRef.current = { data: [true], isLoading: false }
    render(
      <EntityBadge
        variant="contract"
        address={TEST_ADDRESS}
        etherscanHref={TEST_TX_URL}
      >
        contract-content
      </EntityBadge>,
    )
    const primary = screen.getByText('contract-content').closest('a')
    expect(primary).toHaveAttribute('href', '/resolver/$address')
    expect(primary?.dataset.params).toBe(
      JSON.stringify({ address: TEST_ADDRESS }),
    )
    // Not an external link
    expect(primary).not.toHaveAttribute('target', '_blank')
  })
})

describe('EntityBadge hover chips', () => {
  // Chip text labels collide with SVG <title> elements that share the same
  // string (e.g. <title>Name</title> inside ChipNameIcon). Exclude title nodes
  // when searching by text so the visible chip label is matched instead.
  const IGNORE_SVG_TITLE = { ignore: 'script, style, title' }

  it('variant="name" shows Name + Owner chips', () => {
    render(
      <EntityBadge variant="name" name="alice.eth" ownerName="bob.eth">
        alice-content
      </EntityBadge>,
    )
    const nameChip = screen.getByText('Name', IGNORE_SVG_TITLE).closest('a')
    expect(nameChip).toHaveAttribute('href', '/$name')
    expect(nameChip?.dataset.params).toBe(JSON.stringify({ name: 'alice.eth' }))

    const ownerChip = screen.getByText('Owner', IGNORE_SVG_TITLE).closest('a')
    expect(ownerChip).toHaveAttribute('href', '/$name')
    expect(ownerChip?.dataset.params).toBe(JSON.stringify({ name: 'bob.eth' }))
  })

  it('variant="name" falls back to ownerAddress when ownerName is absent', () => {
    render(
      <EntityBadge variant="name" name="alice.eth" ownerAddress={TEST_ADDRESS}>
        alice-content
      </EntityBadge>,
    )
    const ownerChip = screen.getByText('Owner', IGNORE_SVG_TITLE).closest('a')
    expect(ownerChip).toHaveAttribute('href', '/addr/$addr')
    expect(ownerChip?.dataset.params).toBe(
      JSON.stringify({ addr: TEST_ADDRESS }),
    )
  })

  it('variant="address" shows an Address chip', () => {
    render(
      <EntityBadge variant="address" address={TEST_ADDRESS}>
        addr-content
      </EntityBadge>,
    )
    const addressChip = screen
      .getByText('Address', IGNORE_SVG_TITLE)
      .closest('a')
    expect(addressChip).toHaveAttribute('href', '/addr/$addr')
    expect(addressChip?.dataset.params).toBe(
      JSON.stringify({ addr: TEST_ADDRESS }),
    )
  })

  it('variant="tx" shows an Etherscan chip when etherscanHref is set', () => {
    render(
      <EntityBadge variant="tx" etherscanHref={TEST_TX_URL}>
        0xabc
      </EntityBadge>,
    )
    const chip = screen.getByText('Etherscan', IGNORE_SVG_TITLE).closest('a')
    expect(chip).toHaveAttribute('href', TEST_TX_URL)
    expect(chip).toHaveAttribute('target', '_blank')
    expect(chip).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('variant="contract" shows the contract name chip when getEnsContractName returns a name', () => {
    contractNameRef.current = 'ENS Public Resolver'
    render(
      <EntityBadge
        variant="contract"
        address={TEST_ADDRESS}
        etherscanHref={TEST_TX_URL}
      >
        contract-content
      </EntityBadge>,
    )
    // Chip surfaces the contract name as both label and copy value.
    const contractNameChip = screen.getByText('ENS Public Resolver')
    expect(contractNameChip.closest('button')).not.toBeNull()
  })
})

describe('EntityActionCopy clipboard interaction', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the copy value to the clipboard and shows the copied state, then reverts after 2s', async () => {
    render(
      <EntityBadge variant="default" copyValue="0xabc">
        default-with-copy
      </EntityBadge>,
    )
    const button = screen.getByRole('button', { name: /copy/i })
    expect(button).toHaveTextContent('Copy')

    await act(async () => {
      fireEvent.click(button)
    })

    expect(writeText).toHaveBeenCalledWith('0xabc')
    // Copied state swaps the icon and keeps the label: chips whose label is the
    // value itself (an address in a hover card) must not resize mid-copy.
    expect(button).toHaveTextContent('Copy')
    expect(button.querySelector('.lucide-check')).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(button).toHaveTextContent('Copy')
    expect(button.querySelector('.lucide-check')).toBeNull()
  })
})
