import { type Role, registryRoles } from '@ensdomains/ensjs/utils/v2'

/**
 * Decodes a role bitmap into an array of role names.
 * This is the inverse of `encodeRoleBitmap` from ensjs.
 *
 * @param bitmap - The role bitmap as a bigint or hex string
 * @returns Array of role names that are set in the bitmap
 *
 * @example
 * decodeRoleBitmap('0x5') // ['ROLE_RENEW', 'ROLE_SET_SUBREGISTRY']
 * decodeRoleBitmap(5n)    // ['ROLE_RENEW', 'ROLE_SET_SUBREGISTRY']
 */
export const decodeRoleBitmap = (bitmap: bigint | string): Role[] => {
  const bitmapValue = typeof bitmap === 'string' ? BigInt(bitmap) : bitmap

  const roles: Role[] = []

  for (const [roleName, roleValue] of Object.entries(registryRoles)) {
    if ((bitmapValue & roleValue) !== 0n) {
      roles.push(roleName as Role)
    }
  }

  return roles
}
