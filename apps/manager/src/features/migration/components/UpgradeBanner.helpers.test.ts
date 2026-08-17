import { describe, expect, it } from 'vitest'
import { makeClassified } from '../service/_fixtures'
import { shouldShowUpgradeBanner } from './UpgradeBanner.helpers'

const name = (value: string) =>
  makeClassified({ id: value, name: value, label: value.split('.')[0] })

describe('shouldShowUpgradeBanner', () => {
  it('shows the account-level banner when there are eligible names and migration has not started', () => {
    expect(
      shouldShowUpgradeBanner({
        eligibleV1Names: [name('alice.eth')],
        migratedCount: 0,
      }),
    ).toBe(true)
  })

  it('hides the account-level banner after migration has started', () => {
    expect(
      shouldShowUpgradeBanner({
        eligibleV1Names: [name('alice.eth')],
        migratedCount: 1,
      }),
    ).toBe(false)
  })

  it('shows the profile banner when the current profile is eligible for migration', () => {
    expect(
      shouldShowUpgradeBanner({
        eligibleV1Names: [name('alice.eth')],
        migratedCount: 1,
        profileName: 'Alice.eth',
      }),
    ).toBe(true)
  })

  it('shows the profile banner without an account-level migrated count', () => {
    expect(
      shouldShowUpgradeBanner({
        eligibleV1Names: [name('alice.eth')],
        migratedCount: undefined,
        profileName: 'alice.eth',
      }),
    ).toBe(true)
  })

  it('hides the profile banner when only another name is eligible for migration', () => {
    expect(
      shouldShowUpgradeBanner({
        eligibleV1Names: [name('alice.eth')],
        migratedCount: 0,
        profileName: 'fresh.eth',
      }),
    ).toBe(false)
  })
})
