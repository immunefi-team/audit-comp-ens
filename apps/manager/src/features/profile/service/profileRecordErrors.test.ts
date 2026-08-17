import { describe, expect, it } from 'vitest'
import {
  getRecordsValidationErrorMessage,
  getSaveRecordsErrorMessage,
  RecordsValidationError,
} from './profileRecordErrors'

describe('getSaveRecordsErrorMessage', () => {
  it('returns the message for non-validation save errors', () => {
    expect(
      getSaveRecordsErrorMessage(new Error('User rejected the transaction')),
    ).toBe('User rejected the transaction')
  })

  it('does not return validation errors that render next to fields', () => {
    expect(
      getSaveRecordsErrorMessage(
        new RecordsValidationError([
          {
            sectionKey: 'address',
            fieldKey: '60',
            message: 'Invalid ETH address',
          },
        ]),
      ),
    ).toBeUndefined()
  })
})

describe('getRecordsValidationErrorMessage', () => {
  it('points users to the tab that owns a validation issue', () => {
    expect(
      getRecordsValidationErrorMessage(
        new RecordsValidationError([
          {
            sectionKey: 'bio',
            fieldKey: 'url',
            message: 'Invalid Bio URL',
          },
        ]),
      ),
    ).toBe('Invalid Bio URL. Go to General to fix.')
  })

  it('formats multiple validation issues with their owning tabs', () => {
    expect(
      getRecordsValidationErrorMessage(
        new RecordsValidationError([
          {
            sectionKey: 'contact',
            fieldKey: 'email',
            message: 'Enter a valid email address',
          },
          {
            sectionKey: 'links',
            fieldKey: 'links[0].url',
            message: 'Invalid Link URL',
          },
        ]),
      ),
    ).toBe(
      'Enter a valid email address. Go to Contact to fix.\nInvalid Link URL. Go to Links to fix.',
    )
  })
})
