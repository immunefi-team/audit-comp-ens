import { describe, expect, it } from 'vitest'
import type { ProfileRecords } from '@/features/profile/types'
import {
  generalShortcuts,
  getDefaultVisibleFields,
  getGeneralValidationIssues,
  removeGeneralFieldValue,
} from './fields'

const createRecords = (base: ProfileRecords['base'] = {}): ProfileRecords => ({
  base,
  contact: [],
  social: [],
  addresses: [],
  links: [],
  unknown: [],
  agentRegistrations: [],
})

describe('general profile fields', () => {
  it('offers full name as a general shortcut', () => {
    const fields = generalShortcuts.map(({ field }) => field)

    expect(fields).toContain('name')
    expect(generalShortcuts.find(({ field }) => field === 'name')?.label).toBe(
      'Full name',
    )
  })

  it('selects full name when the saved profile has a name', () => {
    expect(
      getDefaultVisibleFields(createRecords({ name: 'Yoginth' })),
    ).toContain('name')
  })

  it.each([
    undefined,
    '',
    '   ',
  ])('leaves full name unselected when the saved name is %p', (name) => {
    expect(getDefaultVisibleFields(createRecords({ name }))).not.toContain(
      'name',
    )
  })

  it.each([
    ['avatar', 'base'],
    ['header', 'base'],
    ['url', 'base'],
    ['description', 'base'],
    ['name', 'base'],
    ['language', 'base'],
    ['location', 'contact'],
    ['timezone', 'contact'],
  ] as const)('removes the %s record value when toggled off', (field, section) => {
    const records = {
      ...createRecords({
        avatar: 'https://example.com/avatar.png',
        description: 'Bio',
        header: 'https://example.com/banner.png',
        language: 'en',
        name: 'Yoginth',
        url: 'https://example.com',
      }),
      contact: [
        { key: 'location', value: 'Bengaluru' },
        { key: 'timezone', value: 'UTC+5' },
      ],
    }

    const result = removeGeneralFieldValue(records, field)

    if (section === 'base') {
      expect(result.base[field]).toBeUndefined()
      return
    }

    expect(result.contact.some((record) => record.key === field)).toBe(false)
  })

  it('reports invalid custom link values as general validation issues', () => {
    expect(
      getGeneralValidationIssues(createRecords({ url: 'fffasdf' })),
    ).toEqual([
      {
        field: 'url',
        message: 'Enter a valid URL (e.g. https://example.com)',
      },
    ])
  })
})
