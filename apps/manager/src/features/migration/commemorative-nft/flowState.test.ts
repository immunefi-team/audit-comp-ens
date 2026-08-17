import { describe, expect, it } from 'vitest'
import {
  getCommemorativeNftClaimedStatus,
  getCommemorativeNftFlowStatus,
  isCommemorativeNftClaimResultFresh,
} from './flowState'

const base = {
  eligibilityStatus: 'eligible' as const,
  claimed: false,
  revealComplete: true,
  claimPending: false,
  claimError: false,
}

describe('commemorative NFT flow state', () => {
  it('treats the display-only preview as unclaimed without a chain query', () => {
    expect(
      getCommemorativeNftClaimedStatus({
        preview: true,
        claimed: undefined,
        isFresh: false,
      }),
    ).toBe(false)
    expect(
      getCommemorativeNftClaimedStatus({
        preview: false,
        claimed: undefined,
        isFresh: false,
      }),
    ).toBeUndefined()
  })

  it('does not treat a cached unclaimed result as mintable while refetching', () => {
    expect(
      getCommemorativeNftClaimedStatus({
        preview: false,
        claimed: false,
        isFresh: false,
      }),
    ).toBeUndefined()
    expect(
      getCommemorativeNftClaimedStatus({
        preview: false,
        claimed: false,
        isFresh: true,
      }),
    ).toBe(false)
  })

  it('keeps a cached claimed result because it cannot enable minting', () => {
    expect(
      getCommemorativeNftClaimedStatus({
        preview: false,
        claimed: true,
        isFresh: false,
      }),
    ).toBe(true)
  })

  it('does not treat an idle cached result as fresh for a new dialog opening', () => {
    expect(
      isCommemorativeNftClaimResultFresh({
        claimReadKey: '11155111:0x123',
        requiredClaimReadKey: '11155111:0x123',
        dataUpdatedAt: 100,
        requiredDataUpdatedAt: 100,
        isSuccess: true,
        fetchStatus: 'idle',
      }),
    ).toBe(false)
  })

  it('accepts a successful idle result fetched after the dialog opens', () => {
    expect(
      isCommemorativeNftClaimResultFresh({
        claimReadKey: '11155111:0x123',
        requiredClaimReadKey: '11155111:0x123',
        dataUpdatedAt: 101,
        requiredDataUpdatedAt: 100,
        isSuccess: true,
        fetchStatus: 'idle',
      }),
    ).toBe(true)
  })

  it('does not accept a result while its claim query is refetching', () => {
    expect(
      isCommemorativeNftClaimResultFresh({
        claimReadKey: '11155111:0x123',
        requiredClaimReadKey: '11155111:0x123',
        dataUpdatedAt: 101,
        requiredDataUpdatedAt: 100,
        isSuccess: true,
        fetchStatus: 'fetching',
      }),
    ).toBe(false)
  })

  it('does not accept a fresh result for a different claim query', () => {
    expect(
      isCommemorativeNftClaimResultFresh({
        claimReadKey: '11155111:0x456',
        requiredClaimReadKey: '11155111:0x123',
        dataUpdatedAt: 101,
        requiredDataUpdatedAt: 100,
        isSuccess: true,
        fetchStatus: 'idle',
      }),
    ).toBe(false)
  })

  it.each([
    [{ ...base, eligibilityStatus: 'pending' as const }, 'loadingEligibility'],
    [{ ...base, eligibilityStatus: 'ineligible' as const }, 'ineligible'],
    [
      { ...base, eligibilityStatus: 'unavailable' as const },
      'configurationError',
    ],
    [{ ...base, revealComplete: false }, 'revealing'],
    [{ ...base, claimed: undefined }, 'loadingEligibility'],
    [{ ...base, claimed: undefined, claimPending: true }, 'minting'],
    [{ ...base }, 'readyToMint'],
    [{ ...base, claimPending: true }, 'minting'],
    [{ ...base, claimError: true }, 'claimError'],
    [{ ...base, claimed: true }, 'minted'],
    [{ ...base, claimed: true, claimError: true }, 'minted'],
  ])('derives %s as %s', (input, expected) => {
    expect(getCommemorativeNftFlowStatus(input)).toBe(expected)
  })
})
