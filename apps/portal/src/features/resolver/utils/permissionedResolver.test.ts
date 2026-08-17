import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  decodeImplementationAddress,
  filterPermissionedResolverAddresses,
  type ProxyDeployedLog,
  parseProxyDeployedAddress,
} from './permissionedResolver'

describe('decodeImplementationAddress', () => {
  it('returns null for null/undefined input', () => {
    expect(decodeImplementationAddress(null)).toBeNull()
    expect(decodeImplementationAddress(undefined)).toBeNull()
  })

  it('returns null for empty hex', () => {
    expect(decodeImplementationAddress('0x')).toBeNull()
  })

  it('returns null for zero-padded storage', () => {
    expect(
      decodeImplementationAddress(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ),
    ).toBeNull()
  })

  it('decodes a valid address from 32-byte storage slot', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678'
    const storageValue = `0x000000000000000000000000${address.slice(2)}` as Hex

    const result = decodeImplementationAddress(storageValue)
    expect(result?.toLowerCase()).toBe(address.toLowerCase())
  })

  it('returns null for invalid address data', () => {
    expect(decodeImplementationAddress('0xinvalid' as Hex)).toBeNull()
  })
})

describe('parseProxyDeployedAddress', () => {
  it('returns null for empty logs', () => {
    expect(parseProxyDeployedAddress([])).toBeNull()
  })

  it('returns null for logs with no topics', () => {
    expect(parseProxyDeployedAddress([{ topics: [], data: '0x' }])).toBeNull()
  })
})

describe('filterPermissionedResolverAddresses', () => {
  const expectedImpl = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address

  it('returns empty array for empty logs', () => {
    expect(filterPermissionedResolverAddresses([], expectedImpl)).toEqual([])
  })

  it('filters logs by implementation address', () => {
    const logs: ProxyDeployedLog[] = [
      {
        args: {
          implementation: expectedImpl,
          proxyAddress: '0x1111111111111111111111111111111111111111' as Address,
        },
      },
      {
        args: {
          implementation:
            '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address,
          proxyAddress: '0x2222222222222222222222222222222222222222' as Address,
        },
      },
    ]

    const result = filterPermissionedResolverAddresses(logs, expectedImpl)
    expect(result).toHaveLength(1)
    expect(result[0]?.toLowerCase()).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })

  it('deduplicates addresses (case-insensitive)', () => {
    const proxy = '0x1111111111111111111111111111111111111111' as Address
    const logs: ProxyDeployedLog[] = [
      { args: { implementation: expectedImpl, proxyAddress: proxy } },
      { args: { implementation: expectedImpl, proxyAddress: proxy } },
    ]

    const result = filterPermissionedResolverAddresses(logs, expectedImpl)
    expect(result).toHaveLength(1)
  })

  it('returns addresses in reverse log order (most recent first)', () => {
    const logs: ProxyDeployedLog[] = [
      {
        args: {
          implementation: expectedImpl,
          proxyAddress: '0x1111111111111111111111111111111111111111' as Address,
        },
      },
      {
        args: {
          implementation: expectedImpl,
          proxyAddress: '0x2222222222222222222222222222222222222222' as Address,
        },
      },
    ]

    const result = filterPermissionedResolverAddresses(logs, expectedImpl)
    expect(result).toHaveLength(2)
    expect(result[0]?.toLowerCase()).toBe(
      '0x2222222222222222222222222222222222222222',
    )
    expect(result[1]?.toLowerCase()).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })
})
