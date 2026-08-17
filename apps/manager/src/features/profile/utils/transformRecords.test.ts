import { describe, expect, it } from 'vitest'
import {
  newEmptyProfileRecords,
  normalizeProfileRecords,
  transformProfileRecords,
  transformToServiceFormat,
} from './transformRecords'

describe('profile transformRecords utils', () => {
  describe('newEmptyProfileRecords', () => {
    it('should create empty profile records with all sections', () => {
      const records = newEmptyProfileRecords()

      expect(records.base).toEqual({})
      expect(records.addresses).toEqual([])
      expect(records.links).toEqual([])
      expect(records.unknown).toEqual([])
    })

    it('should have empty arrays for all section types', () => {
      const records = newEmptyProfileRecords()

      expect(Array.isArray(records.addresses)).toBe(true)
      expect(Array.isArray(records.links)).toBe(true)
      expect(Array.isArray(records.unknown)).toBe(true)
    })

    it('should create a new object each time', () => {
      const records1 = newEmptyProfileRecords()
      const records2 = newEmptyProfileRecords()

      expect(records1).not.toBe(records2)
      expect(records1.base).not.toBe(records2.base)
      expect(records1.addresses).not.toBe(records2.addresses)
    })
  })

  describe('transformToServiceFormat', () => {
    it('should transform empty records to service format', () => {
      const records = newEmptyProfileRecords()
      const result = transformToServiceFormat(records)

      expect(result.texts).toEqual([])
      expect(result.coins).toEqual([])
    })

    it('should transform base records to texts', () => {
      const records = {
        ...newEmptyProfileRecords(),
        base: {
          description: 'Test description',
          avatar: 'https://example.com/avatar.png',
          'primary-contact': 'email',
          'domains.ens.primary-contacts': JSON.stringify([
            'email',
            'com.twitter',
            'mail',
          ]),
        },
      }

      const result = transformToServiceFormat(records)

      expect(result.texts).toContainEqual({
        key: 'description',
        value: 'Test description',
      })
      expect(result.texts).toContainEqual({
        key: 'avatar',
        value: 'https://example.com/avatar.png',
      })
      expect(result.texts).toContainEqual({
        key: 'primary-contact',
        value: 'email',
      })
      expect(result.texts).toContainEqual({
        key: 'domains.ens.primary-contacts',
        value: JSON.stringify(['email', 'com.twitter', 'mail']),
      })
    })

    it('should transform primary contact text records to base records', () => {
      const result = transformProfileRecords({
        texts: [
          { key: 'primary-contact', value: 'com.twitter' },
          {
            key: 'domains.ens.primary-contacts',
            value: JSON.stringify(['com.twitter', 'email', 'mail']),
          },
        ],
        coins: [],
      })

      expect(result.base['primary-contact']).toBe('com.twitter')
      expect(result.base['domains.ens.primary-contacts']).toBe(
        JSON.stringify(['com.twitter', 'email', 'mail']),
      )
      expect(result.unknown).toEqual([])
    })

    it('should safely parse links JSON and drop unsafe entries from the chain', () => {
      const result = transformProfileRecords({
        texts: [
          {
            key: 'links',
            value: JSON.stringify([
              { name: 'ok', url: 'https://good.com' },
              { name: 'ipfs', url: 'ipfs://QmBad' },
              { name: 'js', url: 'javascript:alert(1)' },
              { name: 'also ok', url: 'https://also.good.com' },
            ]),
          },
        ],
        coins: [],
      })

      expect(result.links).toEqual([
        { name: 'ok', url: 'https://good.com' },
        { name: 'also ok', url: 'https://also.good.com' },
      ])
      expect(result.unknown).toEqual([])
    })

    it('should not throw and should drop all when links JSON is malformed', () => {
      const result = transformProfileRecords({
        texts: [{ key: 'links', value: 'not-json' }],
        coins: [],
      })

      expect(result.links).toEqual([])
    })

    it('should transform addresses to coins', () => {
      const records = {
        ...newEmptyProfileRecords(),
        addresses: [
          { coinType: 60, value: '0x1234567890abcdef' },
          { coinType: 0, value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
        ],
      }

      const result = transformToServiceFormat(records)

      expect(result.coins).toContainEqual({
        coinType: 60,
        value: '0x1234567890abcdef',
      })
      expect(result.coins).toContainEqual({
        coinType: 0,
        value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      })
    })

    it('should filter out empty address values', () => {
      const records = {
        ...newEmptyProfileRecords(),
        addresses: [
          { coinType: 60, value: '0x1234567890abcdef' },
          { coinType: 0, value: '' },
          { coinType: 1, value: '   ' },
        ],
      }

      const result = transformToServiceFormat(records)

      expect(result.coins).toHaveLength(1)
      expect(result.coins[0]).toEqual({
        coinType: 60,
        value: '0x1234567890abcdef',
      })
    })

    it('should transform links to JSON string', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [
          { name: 'Website', url: 'https://example.com' },
          { name: 'Blog', url: 'https://blog.example.com' },
        ],
      }

      const result = transformToServiceFormat(records)

      const linksText = result.texts.find((t) => t.key === 'links')
      expect(linksText).toBeDefined()
      expect(linksText?.value).toBe(JSON.stringify(records.links))
    })

    it('should reject javascript:/data: links at transform time via normalize', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [
          { name: 'bad', url: 'javascript:alert(1)' },
          { name: 'ok', url: 'https://good.com' },
        ],
      }

      const result = transformToServiceFormat(records)

      const linksText = result.texts.find((t) => t.key === 'links')
      expect(linksText).toBeDefined()
      const parsed = JSON.parse(linksText!.value)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].url).toBe('https://good.com')
    })

    it('should omit empty links from the JSON string', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [
          { name: 'Website', url: 'https://example.com' },
          { name: '', url: '' },
          { name: '   ', url: '   ' },
        ],
      }

      const result = transformToServiceFormat(records)

      const linksText = result.texts.find((t) => t.key === 'links')
      expect(linksText?.value).toBe(
        JSON.stringify([{ name: 'Website', url: 'https://example.com' }]),
      )
    })

    it('should not include links when array is empty', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [],
      }

      const result = transformToServiceFormat(records)

      const linksText = result.texts.find((t) => t.key === 'links')
      expect(linksText).toBeUndefined()
    })

    it('should not include links when every link is empty', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [{ name: '', url: '' }],
      }

      const result = transformToServiceFormat(records)

      const linksText = result.texts.find((t) => t.key === 'links')
      expect(linksText).toBeUndefined()
    })

    it('should transform unknown records', () => {
      const records = {
        ...newEmptyProfileRecords(),
        unknown: [
          { key: 'custom.field', value: 'custom value' },
          { key: 'another.custom', value: 'another value' },
        ],
      }

      const result = transformToServiceFormat(records)

      expect(result.texts).toContainEqual({
        key: 'custom.field',
        value: 'custom value',
      })
      expect(result.texts).toContainEqual({
        key: 'another.custom',
        value: 'another value',
      })
    })

    it('should combine all text types', () => {
      const records = {
        ...newEmptyProfileRecords(),
        base: {
          description: 'Test',
        },
        unknown: [{ key: 'custom', value: 'value' }],
        links: [{ name: 'Link', url: 'https://example.com' }],
      }

      const result = transformToServiceFormat(records)

      expect(result.texts.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle null and undefined values gracefully', () => {
      const records = {
        ...newEmptyProfileRecords(),
        addresses: [
          { coinType: 60, value: '0x1234' },
          { coinType: 0, value: null as unknown as string },
          { coinType: 1, value: undefined as unknown as string },
        ],
      }

      const result = transformToServiceFormat(records)

      expect(result.coins).toHaveLength(1)
    })
  })

  describe('normalizeProfileRecords', () => {
    it('should remove fully empty links without changing other records', () => {
      const records = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
        links: [
          { name: 'Website', url: 'https://example.com' },
          { name: '', url: '' },
        ],
      }

      const normalized = normalizeProfileRecords(records)

      expect(normalized).toEqual({
        ...records,
        links: [{ name: 'Website', url: 'https://example.com' }],
      })
    })

    it('should drop unsafe scheme links (javascript:/data:) during normalize', () => {
      const records = {
        ...newEmptyProfileRecords(),
        links: [
          { name: 'ok', url: 'https://good.com' },
          { name: 'bad', url: 'javascript:alert(1)' },
          { name: 'data', url: 'data:text/html,hi' },
        ],
      }

      const normalized = normalizeProfileRecords(records)

      expect(normalized.links).toEqual([
        { name: 'ok', url: 'https://good.com' },
      ])
    })

    it('should remove empty address drafts without changing filled addresses', () => {
      const records = {
        ...newEmptyProfileRecords(),
        addresses: [
          { coinType: 60, value: '0x1234567890abcdef' },
          { coinType: 0, value: '' },
          { coinType: 501, value: '   ' },
        ],
      }

      const normalized = normalizeProfileRecords(records)

      expect(normalized.addresses).toEqual([
        { coinType: 60, value: '0x1234567890abcdef' },
      ])
    })

    it('should normalize social profile URLs before saving records', () => {
      const records = {
        ...newEmptyProfileRecords(),
        social: [
          { key: 'com.linkedin', value: 'https://www.linkedin.com/in/ebeau/' },
          { key: 'com.twitter', value: '@ensdomains' },
          { key: 'org.telegram', value: 'https://t.me/ensdomains' },
        ],
      }

      const normalized = normalizeProfileRecords(records)

      expect(normalized.social).toEqual([
        { key: 'com.linkedin', value: 'ebeau' },
        { key: 'com.twitter', value: 'ensdomains' },
        { key: 'org.telegram', value: 'ensdomains' },
      ])
    })
  })

  describe('agent-registration records', () => {
    // ERC-7930 encoded mainnet (chain ID 1) address for the known 8004.eth
    // registry 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432.
    const KNOWN_REGISTRY_HEX =
      '0x00010000010114' + '8004a169fb4a3325136eb29fa0ceb6d2e539a432'
    const agentKey = `agent-registration[${KNOWN_REGISTRY_HEX}][19151]`

    it('should start with an empty agentRegistrations array', () => {
      expect(newEmptyProfileRecords().agentRegistrations).toEqual([])
    })

    it('should route a valid agent-registration record to agentRegistrations', () => {
      const result = transformProfileRecords({
        texts: [{ key: agentKey, value: '1' }],
        coins: [],
      })

      expect(result.agentRegistrations).toHaveLength(1)
      expect(result.agentRegistrations[0]).toMatchObject({
        key: agentKey,
        value: '1',
        agentId: '19151',
        chainId: 1,
        registryAddress: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
        registryDisplayName: '8004.eth',
      })
      // Must not leak into the generic `unknown` bucket.
      expect(result.unknown).toEqual([])
    })

    it('should fall back to unknown for an invalid agent-registration record', () => {
      const badKey = 'agent-registration[invalid][123]'
      const result = transformProfileRecords({
        texts: [{ key: badKey, value: '1' }],
        coins: [],
      })

      expect(result.agentRegistrations).toEqual([])
      expect(result.unknown).toEqual([{ key: badKey, value: '1' }])
    })

    it('should keep standard records working alongside an agent record', () => {
      const result = transformProfileRecords({
        texts: [
          { key: 'description', value: 'hello' },
          { key: 'com.twitter', value: 'ensdomains' },
          { key: agentKey, value: '1' },
        ],
        coins: [],
      })

      expect(result.base.description).toBe('hello')
      expect(result.social).toContainEqual({
        key: 'com.twitter',
        value: 'ensdomains',
      })
      expect(result.agentRegistrations).toHaveLength(1)
      expect(result.agentRegistrations[0]?.agentId).toBe('19151')
    })
  })
})
