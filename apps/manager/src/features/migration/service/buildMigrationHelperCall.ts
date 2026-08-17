import type { Call } from '@ens-apps/transaction-manager'
import { encodeFunctionData } from 'viem'

import { MIGRATION_HELPER_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import { dnsEncodeName } from '../utils/dnsEncodeName'
import type { ClassifiedName } from './classifyNames'
import type { MigrationData } from './encodeMigration'

export type MigrationHelperNameInput = {
  readonly name: string
  readonly tokenType: ClassifiedName['tokenType']
  readonly parentName: string | null
  readonly data: MigrationData
}

type ChildGroup = {
  readonly parentName: string
  readonly names: string[]
  readonly data: MigrationData[]
}

const asOwnerGroup = (
  names: readonly MigrationHelperNameInput[],
): readonly (readonly MigrationData[])[] =>
  names.length > 0 ? [names.map(({ data }) => data)] : []

const buildChildGroups = (
  names: readonly MigrationHelperNameInput[],
): readonly ChildGroup[] => {
  // Local mutation keeps grouping O(n); inputs and the returned collection
  // retain readonly surfaces.
  const groups = new Map<string, ChildGroup>()
  for (const name of names) {
    if (
      name.tokenType !== 'locked-child' &&
      name.tokenType !== 'detached-child'
    ) {
      continue
    }
    if (!name.parentName) {
      throw new Error(`Child migration "${name.name}" has no parent name`)
    }

    const existing = groups.get(name.parentName)
    if (existing) {
      existing.names.push(name.name)
      existing.data.push(name.data)
      continue
    }
    groups.set(name.parentName, {
      parentName: name.parentName,
      names: [name.name],
      data: [name.data],
    })
  }
  return [...groups.values()]
}

/** Build one HCA-callable helper migration for the names in a gas batch. */
export const buildMigrationHelperCall = (
  names: readonly MigrationHelperNameInput[],
): Call => {
  const unwrapped = names
    .filter(({ tokenType }) => tokenType === 'unwrapped')
    .map(({ data }) => data)
  const unlockedGroups = asOwnerGroup(
    names.filter(({ tokenType }) => tokenType === 'unlocked'),
  )
  const lockedGroups = asOwnerGroup(
    names.filter(({ tokenType }) => tokenType === 'locked-2ld'),
  )
  const lockedChildrenGroups = buildChildGroups(names).map((group) => ({
    parentName: dnsEncodeName(group.parentName),
    groups: [group.data],
  }))

  return {
    to: V2_CONTRACTS.MigrationHelper,
    value: 0n,
    data: encodeFunctionData({
      abi: MIGRATION_HELPER_ABI,
      functionName: 'migrate',
      args: [unwrapped, unlockedGroups, lockedGroups, lockedChildrenGroups],
    }),
  }
}
