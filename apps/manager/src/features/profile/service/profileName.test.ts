import { describe, expect, it } from 'vitest'
import { normalizeEth2LdName, normalizeEthName } from './profileName'

describe('normalizeEthName', () => {
  it('normalizes ENS names before splitting labels', () => {
    expect(normalizeEthName('Sub.FOO.ETH')).toEqual({
      leafLabel: 'sub',
      name: 'sub.foo.eth',
      parentLabelsRootFirst: ['foo'],
    })
  })

  it('rejects invalid ENS names', () => {
    expect(normalizeEthName('xn--raffy.eth')).toBeNull()
    expect(normalizeEthName('foo..eth')).toBeNull()
    expect(normalizeEthName('foo.com')).toBeNull()
  })
})

describe('normalizeEth2LdName', () => {
  it('only accepts normalized 2LD .eth names', () => {
    expect(normalizeEth2LdName('FOO.ETH')).toEqual({
      label: 'foo',
      name: 'foo.eth',
    })
    expect(normalizeEth2LdName('sub.foo.eth')).toBeNull()
  })
})
