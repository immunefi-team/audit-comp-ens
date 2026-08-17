import { describe, expect, it } from 'vitest'
import { isKnownPublicResolver } from './knownResolvers'

describe('isKnownPublicResolver', () => {
  it.each([
    ['null', null, false],
    ['empty string', '', false],
    [
      'known resolver (lowercase)',
      '0x640294a2b2d87e7f522db3e3e3e876764bce170d',
      true,
    ],
    [
      'known resolver (checksum)',
      '0x1da022710dF5002339274AaDEe8D58218e9D6AB5',
      true,
    ],
    [
      'known resolver (uppercase)',
      '0xC30BA2BD21583605D815826C3807E8224E398E10',
      true,
    ],
    [
      'known Sepolia PublicResolver',
      '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD',
      true,
    ],
    // This actually resolves to 0x640294a2b2d87e7f522db3e3e3e876764bce170d
    // [
    //   'Sepolia V1 PublicResolver',
    //   '0x640294a2b2d87e7f522db3e3e3e876764bce170d',
    //   true,
    // ],
    ['unknown resolver', '0x0000000000000000000000000000000000000001', false],
  ])('returns %s → %s', (_, input, expected) => {
    expect(isKnownPublicResolver(input)).toBe(expected)
  })
})
