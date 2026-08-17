import type { DecodedFuses } from '@ensdomains/ensjs/utils'
import { describe, expect, it, vi } from 'vitest'

// Mock to avoid pulling the full wallet stack into the test
vi.mock('./useNameWrapperData', () => ({
  getNameWrapperData: vi.fn(),
}))

const { countBurned } = await import('./useBurnedFuseCount')

describe('useBurnedFuseCount - countBurned', () => {
  it('should count burned fuses', () => {
    const fuses = {
      CANNOT_UNWRAP: true,
      CANNOT_TRANSFER: true,
      CANNOT_SET_TTL: true,
    } as DecodedFuses['child']

    expect(countBurned(fuses)).toBe(3)
  })

  it('should return 0 when no fuses are burned', () => {
    const fuses = {
      CANNOT_UNWRAP: false,
      CANNOT_TRANSFER: false,
      CANNOT_SET_TTL: false,
    } as DecodedFuses['child']

    expect(countBurned(fuses)).toBe(0)
  })
})
