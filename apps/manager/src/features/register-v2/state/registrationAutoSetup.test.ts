import { describe, expect, it } from 'vitest'
import { getManagerRegistrationPostRegistrationSetup } from './registrationAutoSetup'

describe('getManagerRegistrationPostRegistrationSetup', () => {
  it('returns undefined when there is no owner address', () => {
    expect(
      getManagerRegistrationPostRegistrationSetup({
        ownerAddress: undefined,
        existingPrimaryName: null,
        ownedNamesCount: 0,
      }),
    ).toBeUndefined()
  })

  it('returns undefined when the user already has a primary name', () => {
    expect(
      getManagerRegistrationPostRegistrationSetup({
        ownerAddress: '0x1111111111111111111111111111111111111111',
        existingPrimaryName: 'existing.eth',
        ownedNamesCount: 0,
      }),
    ).toBeUndefined()
  })

  it('returns undefined when ownedNamesCount is missing', () => {
    expect(
      getManagerRegistrationPostRegistrationSetup({
        ownerAddress: '0x1111111111111111111111111111111111111111',
        existingPrimaryName: null,
      }),
    ).toBeUndefined()
  })

  it.each([
    5, 6, 7, 20,
  ])('returns undefined when the user already owns %i names (collector)', (ownedNamesCount) => {
    expect(
      getManagerRegistrationPostRegistrationSetup({
        ownerAddress: '0x1111111111111111111111111111111111111111',
        existingPrimaryName: null,
        ownedNamesCount,
      }),
    ).toBeUndefined()
  })

  it.each([
    0, 1, 2, 3, 4,
  ])('enables setup when the user owns %i names and has no primary name', (ownedNamesCount) => {
    expect(
      getManagerRegistrationPostRegistrationSetup({
        ownerAddress: '0x1111111111111111111111111111111111111111',
        existingPrimaryName: null,
        ownedNamesCount,
      }),
    ).toEqual({
      primaryName: {
        enabled: true,
        syncEthRecord: true,
      },
    })
  })
})
