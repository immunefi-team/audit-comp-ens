import type { DecodedFuses } from '@ensdomains/ensjs/utils'
import { describe, expect, it } from 'vitest'
import { isFuseBurnt } from './isFuseBurnt'

const createFuses = (
  parent: Record<string, boolean>,
  child: Record<string, boolean>,
): DecodedFuses =>
  ({
    parent,
    child,
  }) as unknown as DecodedFuses

describe('isFuseBurnt', () => {
  it('returns false when fuses is undefined', () => {
    expect(isFuseBurnt('CANNOT_UNWRAP', 'Owner', undefined)).toBe(false)
  })

  it('returns true for a burnt parent fuse', () => {
    const fuses = createFuses(
      { PARENT_CANNOT_CONTROL: true, IS_DOT_ETH: false },
      {},
    )
    expect(isFuseBurnt('PARENT_CANNOT_CONTROL', 'Parent', fuses)).toBe(true)
  })

  it('returns false for an unburnt parent fuse', () => {
    const fuses = createFuses(
      { PARENT_CANNOT_CONTROL: false, IS_DOT_ETH: false },
      {},
    )
    expect(isFuseBurnt('PARENT_CANNOT_CONTROL', 'Parent', fuses)).toBe(false)
  })

  it('returns true for a burnt child (owner) fuse', () => {
    const fuses = createFuses(
      {},
      { CANNOT_UNWRAP: true, CANNOT_TRANSFER: false },
    )
    expect(isFuseBurnt('CANNOT_UNWRAP', 'Owner', fuses)).toBe(true)
  })

  it('returns false for an unburnt child (owner) fuse', () => {
    const fuses = createFuses(
      {},
      { CANNOT_UNWRAP: false, CANNOT_TRANSFER: false },
    )
    expect(isFuseBurnt('CANNOT_TRANSFER', 'Owner', fuses)).toBe(false)
  })

  it('returns false for a fuse key that does not exist in parent scope', () => {
    const fuses = createFuses({}, {})
    expect(isFuseBurnt('NONEXISTENT_FUSE', 'Parent', fuses)).toBe(false)
  })

  it('returns false for a fuse key that does not exist in owner scope', () => {
    const fuses = createFuses({}, {})
    expect(isFuseBurnt('NONEXISTENT_FUSE', 'Owner', fuses)).toBe(false)
  })

  it('correctly distinguishes parent and owner scopes for same-named key', () => {
    const fuses = createFuses(
      { SOME_KEY: true } as Record<string, boolean>,
      { SOME_KEY: false } as Record<string, boolean>,
    )
    expect(isFuseBurnt('SOME_KEY', 'Parent', fuses)).toBe(true)
    expect(isFuseBurnt('SOME_KEY', 'Owner', fuses)).toBe(false)
  })
})
