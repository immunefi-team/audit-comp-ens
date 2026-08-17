import { describe, expect, it } from 'vitest'
import { validateContentHash } from './validateContentHash'

describe('validateContentHash', () => {
  it('should return undefined for empty values', () => {
    expect(validateContentHash(undefined)).toBeUndefined()
    expect(validateContentHash('')).toBeUndefined()
    expect(validateContentHash('  ')).toBeUndefined()
  })

  describe('protocol URIs', () => {
    it('should accept ipfs://', () => {
      expect(
        validateContentHash(
          'ipfs://QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4',
        ),
      ).toBeUndefined()
    })

    it('should accept ipns://', () => {
      expect(validateContentHash('ipns://app.ens.domains')).toBeUndefined()
    })

    it('should accept bzz://', () => {
      expect(
        validateContentHash(
          'bzz://d1de9994b4d039f6548d191571c45d344ad459569e9e56e974635ee55e2daa54',
        ),
      ).toBeUndefined()
    })

    it('should accept onion3://', () => {
      expect(
        validateContentHash(
          'onion3://p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd',
        ),
      ).toBeUndefined()
    })

    it('should accept /ipfs/ path format', () => {
      expect(
        validateContentHash(
          '/ipfs/QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4',
        ),
      ).toBeUndefined()
    })

    it('should accept /ipns/ path format', () => {
      expect(validateContentHash('/ipns/app.ens.domains')).toBeUndefined()
    })

    it('should reject protocol without identifier', () => {
      expect(validateContentHash('ipfs://')).toBeDefined()
    })

    it('should reject unknown protocols', () => {
      expect(validateContentHash('ftp://example.com')).toBeDefined()
      expect(validateContentHash('https://example.com')).toBeDefined()
    })
  })

  describe('hex encoded content hashes', () => {
    it('should accept valid encoded content hash', () => {
      // IPFS CIDv0 encoded as content hash (0xe3 prefix)
      expect(
        validateContentHash(
          '0xe3010170122029f2d17be6139079dc48696d1f582a8530eb9805b561eda517e22a892c7e3f1f',
        ),
      ).toBeUndefined()
    })

    it('should reject Ethereum addresses', () => {
      expect(
        validateContentHash('0x7Bc153b2a4C8a2f3428bd0da77a901b81c6dD809'),
      ).toBeDefined()
    })

    it('should reject bare 0x', () => {
      expect(validateContentHash('0x')).toBeDefined()
    })

    it('should reject short invalid hex', () => {
      expect(validateContentHash('0x1234')).toBeDefined()
    })
  })

  describe('invalid inputs', () => {
    it('should reject random text', () => {
      expect(validateContentHash('hello world')).toBeDefined()
    })

    it('should reject plain domains', () => {
      expect(validateContentHash('example.com')).toBeDefined()
    })
  })
})
