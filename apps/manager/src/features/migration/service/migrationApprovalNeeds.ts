import { labelhash } from 'viem/ens'

import type { GroupedNames } from './classifyNames'

export type ApprovalNeeds = {
  readonly hasUnwrapped: boolean
  readonly unwrappedTokenIds: readonly bigint[]
  readonly hasWrapped: boolean
}

/** Derive the minimum helper/HCA permission surface for the selected names. */
export const approvalNeedsFor = (groups: GroupedNames): ApprovalNeeds => {
  const unwrappedTokenIds = [
    ...new Set(groups.unwrapped.map((name) => BigInt(labelhash(name.label)))),
  ]
  return {
    hasUnwrapped: unwrappedTokenIds.length > 0,
    unwrappedTokenIds,
    hasWrapped:
      groups.unlocked.length > 0 ||
      groups.locked2ld.length > 0 ||
      groups.childNames.size > 0,
  }
}
