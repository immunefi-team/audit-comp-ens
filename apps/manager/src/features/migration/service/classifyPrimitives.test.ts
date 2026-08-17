import { describe, expect, it } from 'vitest'
import { makeClassified } from './_fixtures'
import { FUSES, hasFuse, is2LD } from './classifyNames'

describe('FUSES constants', () => {
  it('matches NameWrapper fuse bit layout', () => {
    expect({ ...FUSES }).toEqual({
      CAN_DO_EVERYTHING: 0n,
      CANNOT_UNWRAP: 1n,
      CANNOT_BURN_FUSES: 2n,
      CANNOT_TRANSFER: 4n,
      CANNOT_SET_RESOLVER: 8n,
      CANNOT_SET_TTL: 16n,
      CANNOT_CREATE_SUBDOMAIN: 32n,
      CANNOT_APPROVE: 64n,
      PARENT_CANNOT_CONTROL: 1n << 16n,
      IS_DOT_ETH: 1n << 17n,
      CAN_EXTEND_EXPIRY: 1n << 18n,
    })
  })

  it('uses non-overlapping bits for each fuse', () => {
    const bits = Object.values(FUSES).filter((v) => v !== 0n)
    expect(bits.reduce((a, b) => a | b, 0n)).toBe(
      bits.reduce((a, b) => a + b, 0n),
    )
  })
})

describe('hasFuse', () => {
  it.each([
    [0n, FUSES.CANNOT_UNWRAP, false],
    [FUSES.CANNOT_TRANSFER, FUSES.CANNOT_UNWRAP, false],
    [FUSES.CANNOT_UNWRAP, FUSES.CANNOT_UNWRAP, true],
    [
      FUSES.CANNOT_UNWRAP | FUSES.CANNOT_TRANSFER | FUSES.CANNOT_APPROVE,
      FUSES.CANNOT_TRANSFER,
      true,
    ],
    [
      FUSES.CANNOT_UNWRAP | FUSES.CANNOT_TRANSFER | FUSES.CANNOT_APPROVE,
      FUSES.CANNOT_SET_RESOLVER,
      false,
    ],
    [FUSES.PARENT_CANNOT_CONTROL, FUSES.PARENT_CANNOT_CONTROL, true],
    [FUSES.CANNOT_UNWRAP, FUSES.PARENT_CANNOT_CONTROL, false],
  ])('hasFuse(%i, %i) === %s', (fuses, fuse, expected) => {
    expect(hasFuse(fuses, fuse)).toBe(expected)
  })
})

describe('is2LD', () => {
  it.each([
    ['unwrapped', true],
    ['unlocked', true],
    ['locked-2ld', true],
    ['locked-child', false],
    ['detached-child', false],
  ] as const)('%s → %s', (tokenType, expected) => {
    expect(is2LD(makeClassified({ tokenType, parentName: null }))).toBe(
      expected,
    )
  })
})
