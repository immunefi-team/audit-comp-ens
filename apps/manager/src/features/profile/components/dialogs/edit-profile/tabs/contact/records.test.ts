import { describe, expect, it } from 'vitest'
import { contactMethods, defaultEnabledContactMethodKeys } from './constants'
import * as contactRecordHelpers from './records'
import {
  getContactMethodErrorMessage,
  getContactMethodNoticeMessage,
  getContactValidationIssues,
  getIsPrimaryContactToggleDisabled,
} from './records'

describe('contact record helpers', () => {
  const getContactMethod = (key: string) => {
    const method = contactMethods.find(
      (contactMethod) => contactMethod.key === key,
    )

    if (!method) {
      throw new Error(`Unknown contact method key: ${key}`)
    }

    return method
  }

  describe('defaultEnabledContactMethodKeys', () => {
    it('preselects only X and Telegram by default', () => {
      expect([...defaultEnabledContactMethodKeys]).toEqual([
        'com.twitter',
        'org.telegram',
      ])
    })
  })

  describe('contact error message presentation', () => {
    it('uses the 12px warning icon treatment from the edit profile design', () => {
      expect(contactRecordHelpers.contactErrorMessageIconSymbol).toBe('warning')
      expect(contactRecordHelpers.contactErrorMessageClassName).toContain(
        'text-xs',
      )
      expect(contactRecordHelpers.contactErrorMessageClassName).toContain(
        'text-ens-signal-danger-600',
      )
    })
  })

  describe('getContactMethodNoticeMessage', () => {
    it('shows the public profile visibility notice for email, address, and phone', () => {
      expect(
        ['email', 'mail', 'phone'].map((key) =>
          getContactMethodNoticeMessage(getContactMethod(key)),
        ),
      ).toEqual([
        'Your contact information is publicly viewable on your profile.',
        'Your contact information is publicly viewable on your profile.',
        'Your contact information is publicly viewable on your profile.',
      ])
    })

    it('does not show the public profile visibility notice for social methods', () => {
      expect(
        getContactMethodNoticeMessage(getContactMethod('com.twitter')),
      ).toBeUndefined()
    })
  })

  describe('getIsPrimaryContactToggleDisabled', () => {
    it('keeps unselected empty contact methods enabled while there are primary slots available', () => {
      expect(
        getIsPrimaryContactToggleDisabled({
          isPrimary: false,
          primaryContactCount: 0,
        }),
      ).toBe(false)
    })

    it('disables unselected contact methods when every primary slot is already used', () => {
      expect(
        getIsPrimaryContactToggleDisabled({
          isPrimary: false,
          primaryContactCount: 3,
        }),
      ).toBe(true)
    })

    it('keeps selected contact methods enabled so they can be unpinned', () => {
      expect(
        getIsPrimaryContactToggleDisabled({
          isPrimary: true,
          primaryContactCount: 3,
        }),
      ).toBe(false)
    })
  })

  describe('primary contact error message', () => {
    it('requires a value when a contact method is pinned as primary', () => {
      expect(
        getContactMethodErrorMessage({
          isPrimary: true,
          method: getContactMethod('com.twitter'),
          value: '',
        }),
      ).toBe('Add Twitter before pinning it as a primary contact method.')
    })

    it('does not return an error for unpinned empty contact methods', () => {
      expect(
        getContactMethodErrorMessage({
          isPrimary: false,
          method: getContactMethod('com.twitter'),
          value: '',
        }),
      ).toBeUndefined()
    })

    it('does not return an error for pinned contact methods with a value', () => {
      expect(
        getContactMethodErrorMessage({
          isPrimary: true,
          method: getContactMethod('com.twitter'),
          value: 'ens',
        }),
      ).toBeUndefined()
    })
  })

  describe('getContactMethodErrorMessage', () => {
    it('returns an invalid email error for malformed email contact values', () => {
      expect(
        getContactMethodErrorMessage({
          isPrimary: true,
          method: {
            key: 'email',
            label: 'E-mail',
            placeholder: 'myemail@me.com',
            section: 'contact',
            type: 'email',
          },
          value: 'd',
        }),
      ).toBe('Enter a valid email address')
    })

    it('does not validate empty unpinned email contact values', () => {
      expect(
        getContactMethodErrorMessage({
          isPrimary: false,
          method: {
            key: 'email',
            label: 'E-mail',
            placeholder: 'myemail@me.com',
            section: 'contact',
            type: 'email',
          },
          value: '',
        }),
      ).toBeUndefined()
    })
  })

  describe('primary contact validation', () => {
    it('returns validation issues for pinned empty primary contact methods', () => {
      expect(
        getContactValidationIssues({
          addresses: [],
          base: {
            'domains.ens.primary-contacts': JSON.stringify([
              'com.twitter',
              'email',
            ]),
            'primary-contact': 'com.twitter',
          },
          contact: [{ key: 'email', value: 'test@example.com' }],
          links: [],
          social: [{ key: 'com.twitter', value: '' }],
          unknown: [],
          agentRegistrations: [],
        }),
      ).toEqual([
        {
          key: 'com.twitter',
          message: 'Add Twitter before pinning it as a primary contact method.',
        },
      ])
    })

    it('returns no validation issues when every pinned primary contact has a value', () => {
      expect(
        getContactValidationIssues({
          addresses: [],
          base: {
            'domains.ens.primary-contacts': JSON.stringify(['com.twitter']),
            'primary-contact': 'com.twitter',
          },
          contact: [],
          links: [],
          social: [{ key: 'com.twitter', value: 'ens' }],
          unknown: [],
          agentRegistrations: [],
        }),
      ).toEqual([])
    })
  })

  describe('getContactValidationIssues', () => {
    it('returns validation issues for malformed email contact values', () => {
      expect(
        getContactValidationIssues({
          addresses: [],
          base: {},
          contact: [{ key: 'email', value: 'd' }],
          links: [],
          social: [],
          unknown: [],
          agentRegistrations: [],
        }),
      ).toEqual([{ key: 'email', message: 'Enter a valid email address' }])
    })
  })
})
