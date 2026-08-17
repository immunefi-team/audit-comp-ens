import { labelhash } from 'viem/ens'
import { describe, expect, it } from 'vitest'

import { makeClassified } from './_fixtures'
import type { GroupedNames } from './classifyNames'
import { approvalNeedsFor } from './migrationApprovalNeeds'

const emptyGroups = (): GroupedNames => ({
  unwrapped: [],
  unlocked: [],
  locked2ld: [],
  childNames: new Map(),
})

describe('approvalNeedsFor', () => {
  it('derives and deduplicates BaseRegistrar token ids', () => {
    const alice = makeClassified({ name: 'alice.eth', label: 'alice' })
    expect(
      approvalNeedsFor({
        ...emptyGroups(),
        unwrapped: [alice, alice],
      }),
    ).toEqual({
      hasUnwrapped: true,
      unwrappedTokenIds: [BigInt(labelhash('alice'))],
      hasWrapped: false,
    })
  })

  it('requires one NameWrapper operator permission for every wrapped type', () => {
    for (const groups of [
      { ...emptyGroups(), unlocked: [makeClassified()] },
      { ...emptyGroups(), locked2ld: [makeClassified()] },
      {
        ...emptyGroups(),
        childNames: new Map([['alice.eth', [makeClassified()]]]),
      },
    ]) {
      expect(approvalNeedsFor(groups).hasWrapped).toBe(true)
    }
  })

  it('returns no permissions for an empty selection', () => {
    expect(approvalNeedsFor(emptyGroups())).toEqual({
      hasUnwrapped: false,
      unwrappedTokenIds: [],
      hasWrapped: false,
    })
  })
})
