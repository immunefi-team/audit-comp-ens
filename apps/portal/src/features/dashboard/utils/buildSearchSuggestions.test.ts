import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSearchSuggestions,
  getSearchNotice,
} from './buildSearchSuggestions'

describe('buildSearchSuggestions', () => {
  const mockNavigateToAddress = vi.fn()
  const mockNavigateToName = vi.fn()

  const defaultOptions = {
    isMobile: false,
    navigateToAddress: mockNavigateToAddress,
    navigateToName: mockNavigateToName,
  }

  beforeEach(() => {
    mockNavigateToAddress.mockClear()
    mockNavigateToName.mockClear()
  })

  describe('Empty Input', () => {
    it('should return empty array for empty value', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '',
      })

      expect(result).toEqual([])
    })

    it('should return empty array for whitespace-only value', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '   ',
      })

      expect(result).toEqual([])
    })

    it('should return empty array for names shorter than 3 characters', () => {
      const withTlds = { ...defaultOptions, validTlds: ['eth'] }
      expect(buildSearchSuggestions({ ...withTlds, value: 'a' })).toEqual([])
      expect(buildSearchSuggestions({ ...withTlds, value: 'ab' })).toEqual([])
      // ab.eth — label is 2 chars, should be hidden
      expect(buildSearchSuggestions({ ...withTlds, value: 'ab.eth' })).toEqual(
        [],
      )
      // ab. — trailing dot, label still 2 chars
      expect(buildSearchSuggestions({ ...withTlds, value: 'ab.' })).toEqual([])
    })

    it('should trim leading and trailing whitespace', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '  vitalik  ',
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('vitalik')
      expect(result[1].label).toBe('vitalik.eth')
    })
  })

  describe('Valid Ethereum Addresses', () => {
    const validAddress = '0x205d2686da3bf33f64c17f21462c51b5ead462cf'
    const checksummedAddress = '0x205d2686da3Bf33f64C17f21462c51B5eaD462CF'

    it('should create ONLY address suggestion (no ENS name) on desktop', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: validAddress,
        isMobile: false,
      })

      expect(result.length).toBe(1) // Only address, no ENS name
      expect(result[0].id).toBe(`address:${checksummedAddress}`)
      expect(result[0].label).toBe(checksummedAddress)
      expect(result[0].description).toBe('View address details')
      expect(result[0].inputValue).toBe(checksummedAddress)
    })

    it('should truncate address label on mobile', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: validAddress,
        isMobile: true,
      })

      expect(result.length).toBe(1) // Only address suggestion
      expect(result[0].label).not.toBe(checksummedAddress)
      expect(result[0].label).toContain('0x205d')
      expect(result[0].label).toContain('62CF')
      expect(result[0].inputValue).toBe(checksummedAddress) // inputValue is NOT truncated
    })

    it('should call navigateToAddress when action is invoked', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: validAddress,
      })

      result[0].action()
      expect(mockNavigateToAddress).toHaveBeenCalledWith(checksummedAddress)
    })
  })

  describe('Invalid Addresses', () => {
    it('should treat invalid address format as ENS name', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '0x123', // Too short to be an address
      })

      // Shows both 1LD and .eth version
      expect(result.length).toBe(2)
      expect(result[0].id).toBe('name:0x123')
      expect(result[1].id).toBe('name:0x123.eth')
    })
  })

  describe('ENS Names', () => {
    it('should show both 1LD and .eth version for TLDs like "eth"', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'eth',
      })

      expect(result.length).toBe(2)
      // First suggestion: the 1LD itself
      expect(result[0].id).toBe('name:eth')
      expect(result[0].label).toBe('eth')
      // Second suggestion: with .eth suffix
      expect(result[1].id).toBe('name:eth.eth')
      expect(result[1].label).toBe('eth.eth')
    })

    it('should show both 1LD and .eth version for simple names', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik',
      })

      expect(result.length).toBe(2)
      // First: the name as 1LD
      expect(result[0].id).toBe('name:vitalik')
      expect(result[0].label).toBe('vitalik')
      // Second: with .eth suffix
      expect(result[1].id).toBe('name:vitalik.eth')
      expect(result[1].label).toBe('vitalik.eth')
      expect(result[1].description).toBe('View ENS name details')
    })

    it('should not double-add .eth suffix', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik.eth',
      })

      expect(result.length).toBe(1)
      expect(result[0].label).toBe('vitalik.eth')
      expect(result[0].label).not.toBe('vitalik.eth.eth')
    })

    it('should call navigateToName when action is invoked', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik',
      })

      // Test action on the .eth version
      result[1].action()
      expect(mockNavigateToName).toHaveBeenCalledWith('vitalik.eth')
    })

    it('should lowercase the input', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'VITALIK',
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('vitalik')
      expect(result[1].label).toBe('vitalik.eth')
    })
  })

  describe('Names Starting with 0x (but NOT addresses)', () => {
    it('should NOT truncate name starting with 0x but not being valid address', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '0xdev',
        isMobile: true,
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('0xdev')
      expect(result[1].label).toBe('0xdev.eth')
      expect(result[1].label).not.toContain('...') // Not truncated
    })

    it('should handle 0x names with special characters', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: '0x-test',
        isMobile: true,
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('0x-test')
      expect(result[1].label).toBe('0x-test.eth')
    })
  })

  describe('Edge Cases', () => {
    it('should handle mixed case addresses', () => {
      const mixedCase = '0x205D2686da3Bf33f64C17f21462c51B5eaD462CF'
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: mixedCase,
      })

      expect(result[0].inputValue).toBe(
        '0x205d2686da3Bf33f64C17f21462c51B5eaD462CF',
      )
    })

    it('should handle names with subdomains (no .eth)', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'sub.vitalik',
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('sub.vitalik')
      expect(result[1].label).toBe('sub.vitalik.eth')
    })

    it('should handle names with .eth subdomains', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'sub.vitalik.eth',
      })

      expect(result.length).toBe(1)
      expect(result[0].label).toBe('sub.vitalik.eth')
    })

    it('should suggest multiple TLDs when validTlds is provided and value is single label', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik',
        validTlds: ['eth', 'xyz', 'com'],
      })

      expect(result.length).toBe(3)
      expect(result.map((s) => s.label)).toEqual([
        'vitalik.eth',
        'vitalik.xyz',
        'vitalik.com',
      ])
      result.forEach((s) => {
        expect(s.description).toBe('View ENS name details')
        s.action()
      })
      expect(mockNavigateToName).toHaveBeenCalledTimes(3)
      expect(mockNavigateToName).toHaveBeenNthCalledWith(1, 'vitalik.eth')
      expect(mockNavigateToName).toHaveBeenNthCalledWith(2, 'vitalik.xyz')
      expect(mockNavigateToName).toHaveBeenNthCalledWith(3, 'vitalik.com')
    })

    it('should not use validTlds when value is a complete name', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik.eth',
        validTlds: ['eth', 'xyz'],
      })

      expect(result.length).toBe(1)
      expect(result[0].label).toBe('vitalik.eth')
    })

    it('should suggest all TLDs when only a trailing dot (fox.) - partial TLD empty', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'fox.',
        validTlds: ['eth', 'xyz', 'com'],
      })
      expect(result.length).toBe(3)
      expect(result.map((s) => s.label)).toEqual([
        'fox.eth',
        'fox.xyz',
        'fox.com',
      ])
    })

    it('should suggest only .eth when partial TLD is e (fresh.e) - .eth always included', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'fresh.e',
        validTlds: ['eth', 'xyz', 'box', 'com', 'lol'],
      })
      expect(result.length).toBe(1)
      expect(result[0].label).toBe('fresh.eth')
    })

    it('should suggest .eth and .com when partial TLD is c (fresh.c)', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'fresh.c',
        validTlds: ['eth', 'xyz', 'box', 'com', 'lol'],
      })
      expect(result.length).toBe(2)
      expect(result.map((s) => s.label)).toEqual(['fresh.eth', 'fresh.com'])
    })
  })

  describe('Long ENS Name Truncation', () => {
    it('should truncate long ENS names on mobile', () => {
      // Name without dots gets .eth added
      const longName = 'verylongsubdomainanotherlongsubdomainvitalik'
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: longName,
        isMobile: true,
      })

      expect(result.length).toBe(2)
      // First suggestion (1LD) should be truncated
      expect(result[0].label.length).toBeLessThanOrEqual(30)
      expect(result[0].label).toContain('…')
      expect(result[0].inputValue).toBe(longName)
      // Second suggestion (.eth version) should be truncated
      expect(result[1].label.length).toBeLessThanOrEqual(30)
      expect(result[1].label).toContain('…')
      expect(result[1].label.endsWith('.eth')).toBe(true)
      expect(result[1].inputValue).toBe(`${longName}.eth`)
    })

    it('should NOT truncate long ENS names on desktop', () => {
      const longName = 'verylongsubdomainanotherlongsubdomainvitalik'
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: longName,
        isMobile: false,
      })

      expect(result.length).toBe(2)
      // Labels should be full names on desktop
      expect(result[0].label).toBe(longName)
      expect(result[1].label).toBe(`${longName}.eth`)
      expect(result[1].label).not.toContain('…')
    })

    it('should truncate long subdomain ENS names on mobile', () => {
      // Name with .eth already present
      const longName = 'verylongsubdomain.anotherlongsubdomain.vitalik.eth'
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: longName,
        isMobile: true,
      })

      expect(result.length).toBe(1)
      // Label should be truncated
      expect(result[0].label.length).toBeLessThanOrEqual(30)
      expect(result[0].label).toContain('…')
      expect(result[0].label.endsWith('.eth')).toBe(true)
      // inputValue should be the same (already has .eth)
      expect(result[0].inputValue).toBe(longName)
    })

    it('should NOT truncate short ENS names on mobile', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'vitalik',
        isMobile: true,
      })

      expect(result.length).toBe(2)
      expect(result[0].label).toBe('vitalik')
      expect(result[1].label).toBe('vitalik.eth')
      expect(result[1].label).not.toContain('…')
    })

    it('should truncate address-as-name on mobile', () => {
      const longHexName = '0x1234567890abcdef1234567890abcdef12345678'
      // This is not a valid address (would need proper checksum), so treated as name
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: `${longHexName}z`, // Add 'z' to make it invalid address
        isMobile: true,
      })

      expect(result.length).toBe(2)
      // The .eth version should be truncated
      expect(result[1].label.length).toBeLessThanOrEqual(30)
      expect(result[1].label).toContain('…')
      expect(result[1].label.endsWith('.eth')).toBe(true)
    })
  })

  describe('Subname suggestions', () => {
    it('should suggest test.florin.eth when typing "test.florin.eth" with validTlds', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.florin.eth',
        validTlds: ['eth', 'xyz', 'com'],
      })
      expect(result.length).toBe(1)
      expect(result[0].label).toBe('test.florin.eth')
      expect(result[0].id).toBe('name:test.florin.eth')
    })

    it('should suggest test.florin.eth when typing "test.florin" with validTlds', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.florin',
        validTlds: ['eth', 'xyz', 'com'],
      })
      expect(result.length).toBe(2)
      expect(result[0].label).toBe('test.florin')
      expect(result[1].label).toBe('test.florin.eth')
    })

    it('should still suggest multi-TLD when typing "test." with validTlds', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.',
        validTlds: ['eth', 'xyz', 'com'],
      })
      expect(result.length).toBe(3)
      expect(result.map((s) => s.label)).toEqual([
        'test.eth',
        'test.xyz',
        'test.com',
      ])
    })

    it('should handle deep subnames like a.b.c.eth', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'a.b.c.eth',
        validTlds: ['eth', 'xyz'],
      })
      expect(result.length).toBe(1)
      expect(result[0].label).toBe('a.b.c.eth')
    })

    it('should complete partial TLD on subnames (test.florin.e → test.florin.eth)', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.florin.e',
        validTlds: ['eth', 'xyz', 'com'],
      })
      expect(result.length).toBe(1)
      expect(result[0].label).toBe('test.florin.eth')
    })

    it('should suggest all TLDs for subname with trailing dot (test.florin.)', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.florin.',
        validTlds: ['eth', 'xyz'],
      })
      expect(result.length).toBe(2)
      expect(result.map((s) => s.label)).toEqual([
        'test.florin.eth',
        'test.florin.xyz',
      ])
    })

    it('should suggest subname with non-.eth TLD (test.florin.xyz)', () => {
      const result = buildSearchSuggestions({
        ...defaultOptions,
        value: 'test.florin.xyz',
        validTlds: ['eth', 'xyz'],
      })
      expect(result.length).toBe(1)
      expect(result[0].label).toBe('test.florin.xyz')
    })
  })
})

describe('getSearchNotice', () => {
  const NOTICE = 'Names are at least 3 characters'

  it('flags one and two character labels', () => {
    expect(getSearchNotice('a')).toBe(NOTICE)
    expect(getSearchNotice('tt')).toBe(NOTICE)
    expect(getSearchNotice('tt.eth')).toBe(NOTICE)
    expect(getSearchNotice('12.eth')).toBe(NOTICE)
  })

  it('stays quiet for registrable labels', () => {
    expect(getSearchNotice('abc')).toBeNull()
    expect(getSearchNotice('abc.eth')).toBeNull()
  })

  it('stays quiet for subnames, which have no minimum', () => {
    expect(getSearchNotice('a.florin.eth')).toBeNull()
    expect(getSearchNotice('tt.florin')).toBeNull()
  })

  it('stays quiet for TLDs other than .eth, where the rule does not apply', () => {
    expect(getSearchNotice('tt.co')).toBeNull()
    expect(getSearchNotice('tt.com')).toBeNull()
  })

  it('still warns while the .eth suffix is being typed', () => {
    expect(getSearchNotice('tt.')).toBe(NOTICE)
    expect(getSearchNotice('tt.e')).toBe(NOTICE)
    expect(getSearchNotice('tt.et')).toBe(NOTICE)
  })

  it('stays quiet for addresses and empty input', () => {
    expect(
      getSearchNotice('0xA6362Dcb7Db14C357E788C876eE99e1f982f1115'),
    ).toBeNull()
    expect(getSearchNotice('')).toBeNull()
    expect(getSearchNotice('   ')).toBeNull()
  })

  it('counts emoji labels by code point', () => {
    expect(getSearchNotice('👍👍')).toBe(NOTICE)
    expect(getSearchNotice('👍👍👍')).toBeNull()
  })
})
