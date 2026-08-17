import type { Address } from 'viem'
import type { privateKeyToAccount } from 'viem/accounts'

import { FUSES } from './makeV1Name.js'
import { makeV1Subname } from './makeV1Subname.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type V1HierarchyConfig = {
  rootLabel: string
  childLabels: string[]
  ownerAddress: Address
  ownerAccount: ReturnType<typeof privateKeyToAccount>
  /** Additional fuses per level. Index 0 = 2LD, 1 = first child, etc. */
  fusesPerLevel?: number[]
}

// ---------------------------------------------------------------------------
// makeV1Hierarchy
// ---------------------------------------------------------------------------

/**
 * Creates a locked multi-level NameWrapper hierarchy under an existing locked 2LD.
 * The caller is responsible for creating the root 2LD via makeV1Name with type:'locked'.
 */
export async function makeV1Hierarchy(
  config: V1HierarchyConfig,
): Promise<string[]> {
  const {
    rootLabel,
    childLabels,
    ownerAddress,
    ownerAccount,
    fusesPerLevel = [],
  } = config

  const allNames: string[] = [`${rootLabel}.eth`]

  for (let i = 0; i < childLabels.length; i++) {
    // parentLabel is everything before the first dot of the previous name.
    // e.g. for "sub.alice.eth" the parentLabel passed to makeV1Subname is "alice" (2LD)
    // and for "deep.sub.alice.eth" it is "sub.alice" (the full non-.eth part of the parent).
    const parentName = allNames[allNames.length - 1]
    // Strip the trailing ".eth" to get the parentLabel argument expected by makeV1Subname.
    const parentLabel = parentName.slice(0, -'.eth'.length)

    const childLabel = childLabels[i]
    // CANNOT_UNWRAP locks the child; makeV1Subname always adds PARENT_CANNOT_CONTROL.
    const childFuses = FUSES.CANNOT_UNWRAP | (fusesPerLevel[i + 1] ?? 0)

    const childName = await makeV1Subname({
      parentLabel,
      childLabel,
      ownerAddress,
      ownerAccount,
      parentOwnerAccount: ownerAccount,
      childFuses,
    })

    allNames.push(childName)
  }

  return allNames
}
