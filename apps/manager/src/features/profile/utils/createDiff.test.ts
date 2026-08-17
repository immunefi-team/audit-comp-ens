import { describe, expect, it } from 'vitest'
import { createDiff } from './createDiff'
import { newEmptyProfileRecords } from './transformRecords'

describe('profile createDiff utils', () => {
  describe('createDiff', () => {
    it('should return empty diff for identical records', () => {
      const records = newEmptyProfileRecords()
      const diff = createDiff(records, records)

      expect(diff).toEqual({})
    })

    it('should detect added base field', () => {
      const original = newEmptyProfileRecords()
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: 'New description' },
      }

      const diff = createDiff(original, current)

      expect(Object.keys(diff).length).toBeGreaterThan(0)
      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('added')
      expect(descDiff?.current).toBe('New description')
    })

    it('should detect removed base field', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Old description' },
      }
      const current = newEmptyProfileRecords()

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('removed')
      expect(descDiff?.original).toBe('Old description')
    })

    it('should detect modified base field', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Old description' },
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: 'New description' },
      }

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('modified')
      expect(descDiff?.original).toBe('Old description')
      expect(descDiff?.current).toBe('New description')
    })

    it('should detect primary contact changes as base text records', () => {
      const original = newEmptyProfileRecords()
      const current = {
        ...newEmptyProfileRecords(),
        base: {
          'primary-contact': 'email',
          'domains.ens.primary-contacts': JSON.stringify([
            'email',
            'com.twitter',
            'mail',
          ]),
        },
      }

      const diff = createDiff(original, current)
      const primaryContactDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'primary-contact',
      )
      const primaryContactsDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'domains.ens.primary-contacts',
      )

      expect(primaryContactDiff?.type).toBe('added')
      expect(primaryContactDiff?.fieldLabel).toBe('Primary Contact')
      expect(primaryContactDiff?.current).toBe('email')
      expect(primaryContactsDiff?.type).toBe('added')
      expect(primaryContactsDiff?.fieldLabel).toBe('Primary Contacts')
      expect(primaryContactsDiff?.current).toBe(
        JSON.stringify(['email', 'com.twitter', 'mail']),
      )
    })

    it('should detect added address', () => {
      const original = newEmptyProfileRecords()
      const current = {
        ...newEmptyProfileRecords(),
        addresses: [{ coinType: 60, value: '0x1234567890abcdef' }],
      }

      const diff = createDiff(original, current)

      const addressDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'address',
      )
      expect(addressDiff?.type).toBe('added')
    })

    it('should detect removed address', () => {
      const original = {
        ...newEmptyProfileRecords(),
        addresses: [{ coinType: 60, value: '0x1234567890abcdef' }],
      }
      const current = newEmptyProfileRecords()

      const diff = createDiff(original, current)

      const addressDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'address',
      )
      expect(addressDiff?.type).toBe('removed')
    })

    it('should detect modified address', () => {
      const original = {
        ...newEmptyProfileRecords(),
        addresses: [{ coinType: 60, value: '0x1234567890abcdef' }],
      }
      const current = {
        ...newEmptyProfileRecords(),
        addresses: [{ coinType: 60, value: '0xfedcba0987654321' }],
      }

      const diff = createDiff(original, current)

      const addressDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'address',
      )
      expect(addressDiff?.type).toBe('modified')
    })

    it('should detect added links', () => {
      const original = newEmptyProfileRecords()
      const current = {
        ...newEmptyProfileRecords(),
        links: [{ name: 'Website', url: 'https://example.com' }],
      }

      const diff = createDiff(original, current)

      const linksDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'links',
      )
      expect(linksDiff?.type).toBe('added')
      expect(linksDiff?.current).toBe('1 link')
    })

    it('should detect removed links', () => {
      const original = {
        ...newEmptyProfileRecords(),
        links: [{ name: 'Website', url: 'https://example.com' }],
      }
      const current = newEmptyProfileRecords()

      const diff = createDiff(original, current)

      const linksDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'links',
      )
      expect(linksDiff?.type).toBe('removed')
      expect(linksDiff?.original).toBe('1 link')
    })

    it('should detect modified links', () => {
      const original = {
        ...newEmptyProfileRecords(),
        links: [{ name: 'Website', url: 'https://example.com' }],
      }
      const current = {
        ...newEmptyProfileRecords(),
        links: [
          { name: 'Website', url: 'https://example.com' },
          { name: 'Blog', url: 'https://blog.example.com' },
        ],
      }

      const diff = createDiff(original, current)

      const linksDiff = Object.values(diff).find(
        (d) => d.sectionKey === 'links',
      )
      expect(linksDiff?.type).toBe('modified')
      expect(linksDiff?.original).toBe('1 link')
      expect(linksDiff?.current).toBe('2 links')
    })

    it('should handle empty values as removed', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: '' },
      }

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('removed')
    })

    it('should include section and field labels', () => {
      const original = newEmptyProfileRecords()
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
      }

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.sectionLabel).toBeTruthy()
      expect(descDiff?.fieldLabel).toBeTruthy()
    })

    it('should handle multiple changes across sections', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Old' },
        addresses: [{ coinType: 60, value: '0x1234' }],
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: 'New' },
        addresses: [{ coinType: 60, value: '0x5678' }],
        links: [{ name: 'Website', url: 'https://example.com' }],
      }

      const diff = createDiff(original, current)

      expect(Object.keys(diff).length).toBeGreaterThan(0)
    })

    it('should ignore whitespace-only differences', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: ' Test ' },
      }

      const diff = createDiff(original, current)

      expect(Object.keys(diff).length).toBe(0)
    })

    it('should handle null as empty value', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: null as unknown as string },
      }

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('removed')
    })

    it('should handle undefined as empty value', () => {
      const original = {
        ...newEmptyProfileRecords(),
        base: { description: 'Test' },
      }
      const current = {
        ...newEmptyProfileRecords(),
        base: { description: undefined },
      }

      const diff = createDiff(original, current)

      const descDiff = Object.values(diff).find(
        (d) => d.fieldKey === 'description',
      )
      expect(descDiff?.type).toBe('removed')
    })
  })
})
