import { describe, expect, it } from 'vitest'
import { shouldShowPlainMigrationSuccess } from './MigrationSuccessDialog.helpers'

const configurationError = {
  status: 'error',
  stage: 'configuration',
  message: 'The commemorative NFT preview is not available yet.',
} as const

describe('migration success dialog', () => {
  it('shows a plain migration success when NFT configuration is unavailable', () => {
    expect(
      shouldShowPlainMigrationSuccess({
        context: 'migration',
        state: configurationError,
      }),
    ).toBe(true)
  })

  it('keeps configuration and eligibility errors for non-success contexts', () => {
    expect(
      shouldShowPlainMigrationSuccess({
        context: 'mint-later',
        state: configurationError,
      }),
    ).toBe(false)
    expect(
      shouldShowPlainMigrationSuccess({
        context: 'migration',
        state: {
          status: 'error',
          stage: 'eligibility',
          message: 'Eligibility could not be loaded.',
        },
      }),
    ).toBe(false)
  })
})
