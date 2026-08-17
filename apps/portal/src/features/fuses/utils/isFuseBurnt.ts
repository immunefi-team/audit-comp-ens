import type { DecodedFuses } from '@ensdomains/ensjs/utils'

type FuseScope = 'Parent' | 'Owner'

/**
 * Checks whether a specific fuse is burnt on a name.
 *
 * @param fuseKey - The fuse key to check (e.g. 'CANNOT_UNWRAP', 'PARENT_CANNOT_CONTROL')
 * @param scope - Whether the fuse belongs to 'Parent' or 'Owner' scope
 * @param fuses - The decoded fuses object from wrapper data
 * @returns true if the fuse is burnt, false otherwise
 */
export function isFuseBurnt(
  fuseKey: string,
  scope: FuseScope,
  fuses?: DecodedFuses,
): boolean {
  if (!fuses) return false
  if (scope === 'Parent') {
    const parentFuses = fuses.parent as Record<string, unknown>
    return parentFuses?.[fuseKey] === true
  }
  const childFuses = fuses.child as Record<string, unknown>
  return childFuses?.[fuseKey] === true
}
