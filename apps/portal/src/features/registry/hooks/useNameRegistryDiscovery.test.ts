import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockL1Client = { chain: { id: 11155111 } }

vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok(mockL1Client),
}))

const mockGetNameRegistries = vi.fn()
vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getNameRegistries: mockGetNameRegistries,
}))

const { getNameRegistries } = await import('./useNameRegistryDiscovery')

describe('getNameRegistries', () => {
  beforeEach(() => {
    mockGetNameRegistries.mockClear()
  })

  it('returns registries for 1LD (TLD) name', async () => {
    const mockRegistries = [
      '0x1111111111111111111111111111111111111111', // tld
      '0x0000000000000000000000000000000000000000', // root
    ]
    mockGetNameRegistries.mockResolvedValue(mockRegistries)

    const result = await getNameRegistries({
      name: 'eth',
    })

    expect(result._unsafeUnwrap()).toEqual(mockRegistries)
    expect(mockGetNameRegistries).toHaveBeenCalledWith(mockL1Client, {
      name: 'eth',
    })
  })

  it('returns registries for 2LD name', async () => {
    const mockRegistries = [
      '0x2222222222222222222222222222222222222222', // name
      '0x1111111111111111111111111111111111111111', // tld
      '0x0000000000000000000000000000000000000000', // root
    ]
    mockGetNameRegistries.mockResolvedValue(mockRegistries)

    const result = await getNameRegistries({
      name: 'test.eth',
    })

    expect(result._unsafeUnwrap()).toEqual(mockRegistries)
    expect(mockGetNameRegistries).toHaveBeenCalledWith(mockL1Client, {
      name: 'test.eth',
    })
  })

  it('returns registries for 3LD name', async () => {
    const mockRegistries = [
      '0x3333333333333333333333333333333333333333', // subname
      '0x2222222222222222222222222222222222222222', // name
      '0x1111111111111111111111111111111111111111', // tld
      '0x0000000000000000000000000000000000000000', // root
    ]
    mockGetNameRegistries.mockResolvedValue(mockRegistries)

    const result = await getNameRegistries({
      name: 'sub.test.eth',
    })

    expect(result._unsafeUnwrap()).toEqual(mockRegistries)
    expect(mockGetNameRegistries).toHaveBeenCalledWith(mockL1Client, {
      name: 'sub.test.eth',
    })
  })

  it('returns registries for 4LD name', async () => {
    const mockRegistries = [
      '0x4444444444444444444444444444444444444444', // subsubname
      '0x3333333333333333333333333333333333333333', // subname
      '0x2222222222222222222222222222222222222222', // name
      '0x1111111111111111111111111111111111111111', // tld
      '0x0000000000000000000000000000000000000000', // root
    ]
    mockGetNameRegistries.mockResolvedValue(mockRegistries)

    const result = await getNameRegistries({
      name: 'subsub.sub.test.eth',
    })

    expect(result._unsafeUnwrap()).toEqual(mockRegistries)
    expect(mockGetNameRegistries).toHaveBeenCalledWith(mockL1Client, {
      name: 'subsub.sub.test.eth',
    })
  })

  // Mirrors the on-chain result for 5.4.testing.fresh.eth on Sepolia, where
  // 5's subregistry is not deployed (registries[0] === zeroAddress) but the
  // ancestry chain is intact.
  it('returns registries for 5LD name (FiveOrMoreLD shape)', async () => {
    const mockRegistries = [
      '0x0000000000000000000000000000000000000000', // 5.4.testing.fresh.eth — not deployed
      '0x1e39685086544eD33b561Fb2aa2B22192F5e3c47', // 4.testing.fresh.eth
      '0x4d337208B153620A9ec54Fb27aeF50743F7d4A50', // testing.fresh.eth
      '0x2f8eBF59b8dEeB06d6a0F0443b5bAd9509620d99', // fresh.eth
      '0x796fFF2E907449be8D5921BCC215B1b76D89d080', // .eth
      '0x3A3E15A5d27fF6F05C844313312f2e72096D3eD3', // root
    ]
    mockGetNameRegistries.mockResolvedValue(mockRegistries)

    const result = await getNameRegistries({
      name: '5.4.testing.fresh.eth',
    })

    expect(result._unsafeUnwrap()).toEqual(mockRegistries)
    expect(mockGetNameRegistries).toHaveBeenCalledWith(mockL1Client, {
      name: '5.4.testing.fresh.eth',
    })
  })
})
