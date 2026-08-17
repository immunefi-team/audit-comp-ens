import { describe, expect, it } from 'vitest'
import { resolveDecodedName } from './decodeRawData'

describe('resolveDecodedName', () => {
  it('returns dotted values as full names', () => {
    expect(resolveDecodedName('troy.eth')).toBe('troy.eth')
    expect(resolveDecodedName('alice.parent.eth', 'parent.eth')).toBe(
      'alice.parent.eth',
    )
  })

  it('returns eventName when value is its leading label', () => {
    expect(resolveDecodedName('troy', 'troy.eth')).toBe('troy.eth')
    expect(resolveDecodedName('alice', 'alice.parent.eth')).toBe(
      'alice.parent.eth',
    )
  })

  it('appends a bare label under the event domain', () => {
    expect(resolveDecodedName('alice', 'parent.eth')).toBe('alice.parent.eth')
    expect(resolveDecodedName('parent', 'alice.parent.eth')).toBe(
      'parent.alice.parent.eth',
    )
  })

  it('returns undefined without a usable value or event name', () => {
    expect(resolveDecodedName('')).toBeUndefined()
    expect(resolveDecodedName('troy')).toBeUndefined()
    expect(resolveDecodedName('troy', null)).toBeUndefined()
  })

  it('rejects labelhashes and encoded labels', () => {
    expect(
      resolveDecodedName(
        '0xaf2caa1c2ca1d027f1ac823b529d0a67cd144264b2789fa2ea4d63a67c7103cc',
        'troy.eth',
      ),
    ).toBeUndefined()
    expect(
      resolveDecodedName(
        '[af2caa1c2ca1d027f1ac823b529d0a67cd144264b2789fa2ea4d63a67c7103cc]',
        'troy.eth',
      ),
    ).toBeUndefined()
  })

  it('still accepts legitimate 0x-prefixed names', () => {
    expect(resolveDecodedName('0xdeadbeef.eth')).toBe('0xdeadbeef.eth')
  })
})
