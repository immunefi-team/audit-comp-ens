import { describe, expect, it } from 'vitest'
import {
  getLabelRegistrationError,
  isNormalized,
  isValidEnsName,
} from './isNormalized'

describe('isNormalized', () => {
  it('should return true for normalized ENS names', () => {
    expect(isNormalized('vitalik.eth')).toBe(true)
    expect(isNormalized('sub.vitalik.eth')).toBe(true)
    expect(isNormalized('test-123.eth')).toBe(true)
    expect(isNormalized('')).toBe(true)
  })

  it('should return false for non-normalized names', () => {
    expect(isNormalized('Vitalik.eth')).toBe(false) // uppercase
    expect(isNormalized('ViTaLiK.eth')).toBe(false) // mixed case
    expect(isNormalized('test!@#.eth')).toBe(false) // invalid characters
    expect(isNormalized(' vitalik.eth')).toBe(false) // leading space
  })
})

describe('isValidEnsName', () => {
  it('should return true for 1LDs (TLDs)', () => {
    expect(isValidEnsName('eth')).toBe(true)
    expect(isValidEnsName('com')).toBe(true)
    expect(isValidEnsName('xyz')).toBe(true)
  })

  it('should return true for 2LDs (.eth names)', () => {
    expect(isValidEnsName('vitalik.eth')).toBe(true)
    expect(isValidEnsName('example.eth')).toBe(true)
    expect(isValidEnsName('test-123.eth')).toBe(true)
  })

  it('should return true for 3LDs and deeper', () => {
    expect(isValidEnsName('sub.vitalik.eth')).toBe(true)
    expect(isValidEnsName('deep.sub.vitalik.eth')).toBe(true)
  })

  it('should return false for empty string', () => {
    expect(isValidEnsName('')).toBe(false)
  })

  it('should return false for invalid characters', () => {
    expect(isValidEnsName('test!@#.eth')).toBe(false)
    expect(isValidEnsName('invalid name.eth')).toBe(false) // space
  })

  it('should return false for non-normalized names', () => {
    expect(isValidEnsName('Vitalik.eth')).toBe(false) // uppercase
    expect(isValidEnsName('ETH')).toBe(false) // uppercase 1LD
  })
})

describe('encoded labelhash labels', () => {
  const encoded =
    '[023e0d05ab821f1deb4821991c1a5bb8e1d9d71b7113d61cce6972934f939773]'

  it('accepts names containing an encoded labelhash label', () => {
    expect(isValidEnsName(`${encoded}.baywall.eth`)).toBe(true)
    expect(isNormalized(`${encoded}.baywall.eth`)).toBe(true)
    expect(isValidEnsName(encoded)).toBe(true)
  })

  it('still validates the other labels around it', () => {
    expect(isValidEnsName(`${encoded}.BayWall.eth`)).toBe(false)
    expect(isValidEnsName(`${encoded}..eth`)).toBe(false)
  })

  it('rejects malformed bracket labels', () => {
    expect(isValidEnsName('[abc].eth')).toBe(false) // too short
    expect(
      isValidEnsName(
        '[023E0D05AB821F1DEB4821991C1A5BB8E1D9D71B7113D61CCE6972934F939773].eth',
      ),
    ).toBe(false) // uppercase hex
    expect(
      isValidEnsName(
        '[023e0d05ab821f1deb4821991c1a5bb8e1d9d71b7113d61cce6972934f93977z].eth',
      ),
    ).toBe(false) // non-hex
  })
})

describe('getLabelRegistrationError', () => {
  it('allows normal registrable labels', () => {
    expect(getLabelRegistrationError('mysubname')).toBe(null)
    expect(getLabelRegistrationError('test-123')).toBe(null)
    expect(getLabelRegistrationError('')).toBe(null)
  })

  it('rejects bracket-form labels (encoded labelhash spoofing)', () => {
    expect(
      getLabelRegistrationError(
        '[023e0d05ab821f1deb4821991c1a5bb8e1d9d71b7113d61cce6972934f939773]',
      ),
    ).toMatch(/cannot be registered/)
    expect(getLabelRegistrationError('[abc]')).toMatch(/cannot be registered/)
  })

  it('rejects dots and non-normalized labels', () => {
    expect(getLabelRegistrationError('a.b')).toMatch(/single label/)
    expect(getLabelRegistrationError('MySub')).toMatch(
      /invalid or non-normalized/,
    )
    expect(getLabelRegistrationError('bad name')).toMatch(
      /invalid or non-normalized/,
    )
  })
})
