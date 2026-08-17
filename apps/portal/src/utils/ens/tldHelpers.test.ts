import { describe, expect, it } from 'vitest'
import {
  getTLD,
  is2LD,
  isClaimable,
  isEthName,
  isRegistrable,
  isTLD,
} from './tldHelpers'

describe('tldHelpers', () => {
  describe('isTLD', () => {
    it('should return true for 1LDs (TLDs)', () => {
      expect(isTLD('eth')).toBe(true)
      expect(isTLD('com')).toBe(true)
      expect(isTLD('xyz')).toBe(true)
      expect(isTLD('bob')).toBe(true)
    })

    it('should return false for 2LDs and 3LDs', () => {
      expect(isTLD('florin.eth')).toBe(false)
      expect(isTLD('test.xyz')).toBe(false)
      expect(isTLD('sub.florin.eth')).toBe(false)
    })
  })

  describe('getTLD', () => {
    it('should extract TLD from names', () => {
      expect(getTLD('florin.eth')).toBe('eth')
      expect(getTLD('test.xyz')).toBe('xyz')
      expect(getTLD('sub.florin.eth')).toBe('eth')
      expect(getTLD('eth')).toBe('eth')
    })
  })

  describe('is2LD', () => {
    it('should return true for 2LDs', () => {
      expect(is2LD('florin.eth')).toBe(true)
      expect(is2LD('test.xyz')).toBe(true)
      expect(is2LD('hello.com')).toBe(true)
    })

    it('should return false for 1LDs and 3LDs+', () => {
      expect(is2LD('eth')).toBe(false)
      expect(is2LD('sub.florin.eth')).toBe(false)
      expect(is2LD('a.b.c.eth')).toBe(false)
    })
  })

  describe('isEthName', () => {
    it('should return true for names under .eth', () => {
      expect(isEthName('florin.eth')).toBe(true)
      expect(isEthName('sub.florin.eth')).toBe(true)
    })

    it('should return false for the TLD itself', () => {
      expect(isEthName('eth')).toBe(false)
    })

    it('should return false for non-.eth names', () => {
      expect(isEthName('test.xyz')).toBe(false)
      expect(isEthName('hello.com')).toBe(false)
    })
  })

  describe('isRegistrable', () => {
    it('should return true for .eth 2LDs', () => {
      expect(isRegistrable('florin.eth')).toBe(true)
      expect(isRegistrable('test.eth')).toBe(true)
    })

    it('should return false for non-.eth 2LDs', () => {
      expect(isRegistrable('florin.xyz')).toBe(false)
      expect(isRegistrable('test.com')).toBe(false)
    })

    it('should return false for TLDs', () => {
      expect(isRegistrable('eth')).toBe(false)
      expect(isRegistrable('xyz')).toBe(false)
    })

    it('should return false for 3LDs+', () => {
      expect(isRegistrable('sub.florin.eth')).toBe(false)
    })
  })

  describe('isClaimable', () => {
    it('should return true for non-.eth 2LDs', () => {
      expect(isClaimable('florin.xyz')).toBe(true)
      expect(isClaimable('test.com')).toBe(true)
      expect(isClaimable('hello.io')).toBe(true)
    })

    it('should return false for .eth 2LDs', () => {
      expect(isClaimable('florin.eth')).toBe(false)
    })

    it('should return false for TLDs', () => {
      expect(isClaimable('eth')).toBe(false)
      expect(isClaimable('xyz')).toBe(false)
    })

    it('should return false for 3LDs+', () => {
      expect(isClaimable('sub.florin.xyz')).toBe(false)
    })
  })
})
