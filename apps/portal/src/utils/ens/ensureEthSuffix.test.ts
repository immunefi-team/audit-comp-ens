import { describe, expect, it } from 'vitest'
import { ensureEthSuffix } from './ensureEthSuffix'

describe('ensureEthSuffix', () => {
  it('should append .eth to names without a dot', () => {
    expect(ensureEthSuffix('vitalik')).toBe('vitalik.eth')
    expect(ensureEthSuffix('alice')).toBe('alice.eth')
    expect(ensureEthSuffix('test123')).toBe('test123.eth')
  })

  it('should return names with dots as-is (lowercased)', () => {
    expect(ensureEthSuffix('vitalik.eth')).toBe('vitalik.eth')
    expect(ensureEthSuffix('sub.vitalik.eth')).toBe('sub.vitalik.eth')
    expect(ensureEthSuffix('test.xyz')).toBe('test.xyz')
  })

  it('should lowercase the entire result', () => {
    expect(ensureEthSuffix('Vitalik')).toBe('vitalik.eth')
    expect(ensureEthSuffix('VITALIK')).toBe('vitalik.eth')
    expect(ensureEthSuffix('Vitalik.ETH')).toBe('vitalik.eth')
    expect(ensureEthSuffix('Sub.Vitalik.ETH')).toBe('sub.vitalik.eth')
  })

  it('should handle empty strings', () => {
    expect(ensureEthSuffix('')).toBe('.eth')
  })
})
