import { describe, expect, it } from 'vitest'
import {
  extractAddrFromPath,
  extractNameFromPath,
  extractRegisterName,
  isAddressRoute,
  isAddrSubpage,
  isRegistryRoute,
  isResolverRoute,
  matchContractRoute,
  RESERVED_ROUTE_SEGMENTS,
  STATIC_PATH_PREFIXES,
  truncate,
} from './routing'

const ADDR = '0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d'

describe('routing', () => {
  describe('STATIC_PATH_PREFIXES', () => {
    it('should contain expected static path prefixes', () => {
      expect(STATIC_PATH_PREFIXES).toContain('/assets/')
      expect(STATIC_PATH_PREFIXES).toContain('/og/')
      expect(STATIC_PATH_PREFIXES).toContain('/addr/')
      expect(STATIC_PATH_PREFIXES).toContain('/favicon')
      expect(STATIC_PATH_PREFIXES).toContain('/manifest')
      expect(STATIC_PATH_PREFIXES).toContain('/logo')
    })
  })

  describe('isAddressRoute', () => {
    it('should return true for valid address route', () => {
      expect(
        isAddressRoute('/addr/0x1234567890abcdef1234567890abcdef12345678'),
      ).toBe(true)
    })

    it('should return true for address with uppercase hex', () => {
      expect(
        isAddressRoute('/addr/0xABCDEF1234567890ABCDEF1234567890ABCDEF12'),
      ).toBe(true)
    })

    it('should return false for address with subpage', () => {
      expect(
        isAddressRoute(
          '/addr/0x1234567890abcdef1234567890abcdef12345678/names',
        ),
      ).toBe(false)
    })

    it('should return false for address with invalid length', () => {
      expect(isAddressRoute('/addr/0x1234567890abcdef')).toBe(false)
    })

    it('should return false for non-address route', () => {
      expect(isAddressRoute('/nick.eth')).toBe(false)
    })

    it('should return false for root path', () => {
      expect(isAddressRoute('/')).toBe(false)
    })
  })

  describe('isAddrSubpage', () => {
    it('should return true for address with names subpage', () => {
      expect(
        isAddrSubpage('/addr/0x1234567890abcdef1234567890abcdef12345678/names'),
      ).toBe(true)
    })

    it('should return true for address with history subpage', () => {
      expect(
        isAddrSubpage(
          '/addr/0x1234567890abcdef1234567890abcdef12345678/history',
        ),
      ).toBe(true)
    })

    it('should return true for address with reverse-resolution subpage', () => {
      expect(
        isAddrSubpage(
          '/addr/0x1234567890abcdef1234567890abcdef12345678/reverse-resolution',
        ),
      ).toBe(true)
    })

    it('should return false for plain address route', () => {
      expect(
        isAddrSubpage('/addr/0x1234567890abcdef1234567890abcdef12345678'),
      ).toBe(false)
    })

    it('should return false for nested subpage', () => {
      expect(
        isAddrSubpage(
          '/addr/0x1234567890abcdef1234567890abcdef12345678/foo/bar',
        ),
      ).toBe(false)
    })
  })

  describe('extractAddrFromPath', () => {
    it('should extract address from plain address route', () => {
      const result = extractAddrFromPath(
        '/addr/0x1234567890abcdef1234567890abcdef12345678',
      )
      expect(result).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('should extract address from address with subpage', () => {
      const result = extractAddrFromPath(
        '/addr/0x1234567890abcdef1234567890abcdef12345678/names',
      )
      expect(result).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('should return null for invalid address', () => {
      expect(extractAddrFromPath('/addr/invalid')).toBeNull()
    })

    it('should return null for non-address route', () => {
      expect(extractAddrFromPath('/nick.eth')).toBeNull()
    })
  })

  describe('extractNameFromPath', () => {
    it('should extract simple ENS name', () => {
      expect(extractNameFromPath('/nick.eth')).toBe('nick.eth')
    })

    it('should extract name with subpage', () => {
      expect(extractNameFromPath('/nick.eth/ownership')).toBe('nick.eth')
    })

    it('should extract name with nested subpage', () => {
      expect(extractNameFromPath('/nick.eth/records/some-record')).toBe(
        'nick.eth',
      )
    })

    it('should return null for static paths', () => {
      expect(extractNameFromPath('/assets/script.js')).toBeNull()
      expect(extractNameFromPath('/og/test.png')).toBeNull()
      expect(extractNameFromPath('/favicon.ico')).toBeNull()
      expect(extractNameFromPath('/manifest.json')).toBeNull()
      expect(extractNameFromPath('/logo.svg')).toBeNull()
    })

    it('should return null for paths without leading slash', () => {
      expect(extractNameFromPath('nick.eth')).toBeNull()
    })

    it('should return null for root path', () => {
      expect(extractNameFromPath('/')).toBeNull()
    })

    it('should return null for empty path', () => {
      expect(extractNameFromPath('')).toBeNull()
    })

    it('should return null for names with invalid TLD', () => {
      expect(extractNameFromPath('/nick.com')).toBeNull()
      expect(extractNameFromPath('/nick.io')).toBeNull()
    })

    it('should return name for .eth names', () => {
      expect(extractNameFromPath('/test.eth')).toBe('test.eth')
      expect(extractNameFromPath('/long-name.eth')).toBe('long-name.eth')
    })

    it('should return null for address routes', () => {
      expect(
        extractNameFromPath('/addr/0x1234567890abcdef1234567890abcdef12345678'),
      ).toBeNull()
    })

    it('should handle encoded names', () => {
      expect(extractNameFromPath('/test%20name.eth')).toBe('test%20name.eth')
    })

    it('should return null for reserved route segments', () => {
      expect(extractNameFromPath('/resolver')).toBeNull()
      expect(extractNameFromPath('/registry')).toBeNull()
      expect(extractNameFromPath('/register')).toBeNull()
      expect(extractNameFromPath('/tld')).toBeNull()
      expect(extractNameFromPath('/addr')).toBeNull()
    })

    it('should return null for reserved route subpages', () => {
      // Regression: WEB-509 — `/resolver/0x.../roles` was resolved as the ENS
      // name "resolver", producing an "Available to register" OG preview.
      expect(
        extractNameFromPath(
          '/resolver/0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d/roles',
        ),
      ).toBeNull()
      expect(
        extractNameFromPath(
          '/registry/0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d/labels',
        ),
      ).toBeNull()
      expect(
        extractNameFromPath(
          '/resolver/0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d',
        ),
      ).toBeNull()
    })
  })

  describe('extractRegisterName', () => {
    const params = (search: string) => new URLSearchParams(search)

    it('extracts a .eth name from the register query string', () => {
      // Regression: WEB-509 reserved `/register`, which also stopped
      // `/register?name=foo.eth` from previewing the target name's OG card.
      expect(
        extractRegisterName('/register', params('name=helloaweswomes.eth')),
      ).toBe('helloaweswomes.eth')
    })

    it('handles the trailing-slash register route', () => {
      expect(extractRegisterName('/register/', params('name=nick.eth'))).toBe(
        'nick.eth',
      )
    })

    it('trims surrounding whitespace', () => {
      expect(
        extractRegisterName('/register', params('name=%20nick.eth%20')),
      ).toBe('nick.eth')
    })

    it('returns null when no name is present', () => {
      expect(extractRegisterName('/register', params(''))).toBeNull()
    })

    it('returns null for the bare .eth placeholder', () => {
      expect(extractRegisterName('/register', params('name=.eth'))).toBeNull()
    })

    it('returns null for non-eth names', () => {
      expect(
        extractRegisterName('/register', params('name=nick.com')),
      ).toBeNull()
      expect(extractRegisterName('/register', params('name=nick'))).toBeNull()
    })

    it('returns null for non-2LD subnames the register route cannot handle', () => {
      // Only `label.eth` is registerable; `foo.bar.eth` ends in .eth but the
      // register route rejects it, so its preview would be misleading.
      expect(
        extractRegisterName('/register', params('name=foo.bar.eth')),
      ).toBeNull()
      expect(
        extractRegisterName('/register', params('name=a.b.c.eth')),
      ).toBeNull()
    })

    it('returns null for non-register paths', () => {
      expect(
        extractRegisterName('/registry', params('name=nick.eth')),
      ).toBeNull()
      expect(extractRegisterName('/', params('name=nick.eth'))).toBeNull()
    })
  })

  describe('RESERVED_ROUTE_SEGMENTS', () => {
    it('should contain all dedicated top-level app routes', () => {
      expect(RESERVED_ROUTE_SEGMENTS).toContain('addr')
      expect(RESERVED_ROUTE_SEGMENTS).toContain('register')
      expect(RESERVED_ROUTE_SEGMENTS).toContain('registry')
      expect(RESERVED_ROUTE_SEGMENTS).toContain('resolver')
      expect(RESERVED_ROUTE_SEGMENTS).toContain('tld')
    })
  })

  describe('matchContractRoute', () => {
    it('extracts the address from a plain contract route', () => {
      expect(matchContractRoute(`/resolver/${ADDR}`, 'resolver')).toEqual({
        address: ADDR,
        subpage: null,
      })
    })

    it('extracts the address and subpage from a contract subroute', () => {
      expect(matchContractRoute(`/resolver/${ADDR}/roles`, 'resolver')).toEqual(
        {
          address: ADDR,
          subpage: 'roles',
        },
      )
      expect(
        matchContractRoute(`/registry/${ADDR}/labels`, 'registry'),
      ).toEqual({
        address: ADDR,
        subpage: 'labels',
      })
    })

    it('returns null when the segment does not match', () => {
      expect(matchContractRoute(`/resolver/${ADDR}`, 'registry')).toBeNull()
    })

    it('returns null for a non-address contract route', () => {
      expect(
        matchContractRoute('/resolver/not-an-address', 'resolver'),
      ).toBeNull()
    })
  })

  describe('isResolverRoute / isRegistryRoute', () => {
    it('detects resolver routes', () => {
      expect(isResolverRoute(`/resolver/${ADDR}`)).toBe(true)
      expect(isResolverRoute(`/resolver/${ADDR}/roles`)).toBe(true)
      expect(isResolverRoute(`/registry/${ADDR}`)).toBe(false)
      expect(isResolverRoute('/resolver')).toBe(false)
    })

    it('detects registry routes', () => {
      expect(isRegistryRoute(`/registry/${ADDR}`)).toBe(true)
      expect(isRegistryRoute(`/registry/${ADDR}/labels`)).toBe(true)
      expect(isRegistryRoute(`/resolver/${ADDR}`)).toBe(false)
    })
  })

  describe('truncate', () => {
    it('should not truncate short text', () => {
      expect(truncate('hello', 10)).toBe('hello')
    })

    it('should truncate long text with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello w…')
    })

    it('should handle exact length', () => {
      expect(truncate('hello', 5)).toBe('hello')
    })

    it('should handle maxLength of 1', () => {
      expect(truncate('hello', 1)).toBe('…')
    })

    it('should handle empty string', () => {
      expect(truncate('', 5)).toBe('')
    })

    it('should handle text shorter than maxLength', () => {
      expect(truncate('hi', 10)).toBe('hi')
    })
  })
})
