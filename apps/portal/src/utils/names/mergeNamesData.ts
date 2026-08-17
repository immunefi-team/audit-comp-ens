import type { NameWithRelation } from '@ensdomains/ensjs/subgraph'
import type { ProtocolVersion } from '@/utils/types'

const MS_PER_SECOND = 1000

/**
 * V1 roles - owner and manager for ENS V1 names
 */
export type V1Roles = {
  owner?: boolean
  manager?: boolean
}

/**
 * V1 name structure with date-based expiry
 */
export type V1Name = {
  name: NameWithRelation['name']
  expiryDate?: { date: Date | null } | null
  relation: NameWithRelation['relation']
}

/**
 * V2 name structure with timestamp-based expiry (seconds as number)
 */
export type V2Name = {
  name: string
  subdomains: {
    name: string
  }[]
  expiryDate?: number | null
}

/**
 * V2 name structure with roles
 */
export type V2NameWithRoles = {
  name: string
  expiryDate: number | null
  roleBitmap: string
  subdomainCount: number
  recordCount: number
}

/**
 * Unified name structure for display
 */
export type MergedName = {
  name: string | null
  expiryDate?: Date | null
  subdomainCount?: number
  recordCount?: number
  roleBitmap?: string | null
  v1Roles?: V1Roles | null
  protocolVersion: ProtocolVersion
}

/**
 * Merges V1 and V2 ENS names into a unified format for display.
 * Handles different expiry date formats:
 * - V1: { date: Date | null } or null
 * - V2: number timestamp (seconds) or null
 *
 * @param v1Names - Array of V1 names from Sepolia
 * @param v2Names - Array of V2 names from Namechain Sepolia (with subdomains or roles)
 * @returns Combined array with normalized expiry dates and protocol versions
 *
 * @example
 * const v1 = [{ name: 'vitalik.eth', expiryDate: { date: new Date('2025-01-01') } }]
 * const v2 = [{ name: 'alice.eth', expiryDate: 1735689600, roleBitmap: '0x...' }]
 * mergeNamesData(v1, v2)
 * // [
 * //   { name: 'vitalik.eth', expiryDate: Date('2025-01-01'), protocolVersion: 'ENSv1' },
 * //   { name: 'alice.eth', expiryDate: Date('2025-01-01'), protocolVersion: 'ENSv2', roleBitmap: '0x...' }
 * // ]
 */
export const mergeNamesData = (
  v1Names: V1Name[] | undefined,
  v2Names: (V2Name | V2NameWithRoles)[] | undefined,
): MergedName[] => {
  const v1Transformed: MergedName[] = (v1Names || []).map(
    ({ name, expiryDate, relation }) => ({
      name,
      expiryDate: expiryDate ? expiryDate.date : null,
      protocolVersion: 'ENSv1' as ProtocolVersion,
      roleBitmap: null,
      v1Roles: {
        // For wrapped names: wrappedOwner controls both ownership and management
        // For unwrapped names: registrant is Owner, registry owner is Manager
        owner: relation.registrant || relation.wrappedOwner,
        manager: relation.owner || relation.wrappedOwner,
      },
    }),
  )

  const v2Transformed: MergedName[] = (v2Names || []).map((item) => {
    const hasSubdomainsArray = 'subdomains' in item
    const hasSubdomainCount = 'subdomainCount' in item
    const hasRoleBitmap = 'roleBitmap' in item
    const hasRecordCount = 'recordCount' in item

    return {
      name: item.name,
      expiryDate:
        item.expiryDate !== null && item.expiryDate !== undefined
          ? new Date(item.expiryDate * MS_PER_SECOND)
          : null,
      protocolVersion: 'ENSv2' as ProtocolVersion,
      subdomainCount: hasSubdomainsArray
        ? item.subdomains.length
        : hasSubdomainCount
          ? item.subdomainCount
          : undefined,
      recordCount: hasRecordCount ? item.recordCount : undefined,
      roleBitmap: hasRoleBitmap ? item.roleBitmap : null,
      v1Roles: null,
    }
  })

  return [...v1Transformed, ...v2Transformed].toSorted((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0
    if (!a.expiryDate) return 1
    if (!b.expiryDate) return -1
    return a.expiryDate.getTime() - b.expiryDate.getTime()
  })
}
