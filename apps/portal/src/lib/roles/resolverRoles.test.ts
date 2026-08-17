import { describe, expect, it } from 'vitest'
import {
  decodeResolverRoleBitmap,
  groupRolesByAccount,
  resolverRoles,
} from './resolverRoles'

describe('decodeResolverRoleBitmap', () => {
  it('should decode a single role from bitmap', () => {
    const result = decodeResolverRoleBitmap(resolverRoles.ROLE_SET_ALIAS)

    expect(result).toContain('ROLE_SET_ALIAS')
    expect(result).toHaveLength(1)
  })

  it('should decode multiple roles from bitmap', () => {
    const bitmap =
      resolverRoles.ROLE_SET_ADDR |
      resolverRoles.ROLE_SET_TEXT |
      resolverRoles.ROLE_SET_ALIAS
    const result = decodeResolverRoleBitmap(bitmap)

    expect(result).toContain('ROLE_SET_ADDR')
    expect(result).toContain('ROLE_SET_TEXT')
    expect(result).toContain('ROLE_SET_ALIAS')
    expect(result).toHaveLength(3)
  })

  it('should decode admin roles from bitmap', () => {
    const bitmap =
      resolverRoles.ROLE_SET_ADDR_ADMIN | resolverRoles.ROLE_SET_ALIAS_ADMIN
    const result = decodeResolverRoleBitmap(bitmap)

    expect(result).toContain('ROLE_SET_ADDR_ADMIN')
    expect(result).toContain('ROLE_SET_ALIAS_ADMIN')
    expect(result).toHaveLength(2)
  })

  it('should decode mixed manager and admin roles', () => {
    const bitmap =
      resolverRoles.ROLE_SET_TEXT |
      resolverRoles.ROLE_SET_TEXT_ADMIN |
      resolverRoles.ROLE_CLEAR
    const result = decodeResolverRoleBitmap(bitmap)

    expect(result).toContain('ROLE_SET_TEXT')
    expect(result).toContain('ROLE_SET_TEXT_ADMIN')
    expect(result).toContain('ROLE_CLEAR')
    expect(result).toHaveLength(3)
  })

  it('should handle string bitmap input', () => {
    const bitmap = (
      resolverRoles.ROLE_SET_ADDR | resolverRoles.ROLE_SET_NAME
    ).toString()
    const result = decodeResolverRoleBitmap(bitmap)

    expect(result).toContain('ROLE_SET_ADDR')
    expect(result).toContain('ROLE_SET_NAME')
  })

  it('should handle hex string bitmap input', () => {
    const bitmap = `0x${(resolverRoles.ROLE_SET_CONTENTHASH | resolverRoles.ROLE_SET_ABI).toString(16)}`
    const result = decodeResolverRoleBitmap(bitmap)

    expect(result).toContain('ROLE_SET_CONTENTHASH')
    expect(result).toContain('ROLE_SET_ABI')
  })

  it('should return empty array for zero bitmap', () => {
    expect(decodeResolverRoleBitmap(0n)).toEqual([])
    expect(decodeResolverRoleBitmap('0')).toEqual([])
    expect(decodeResolverRoleBitmap('0x0')).toEqual([])
  })

  it('should decode ALL_ROLES bitmap (0x1111...1111)', () => {
    const allRolesBitmap =
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    const result = decodeResolverRoleBitmap(allRolesBitmap)

    const managerRoles = result.filter((r) => !r.endsWith('_ADMIN'))
    const adminRoles = result.filter((r) => r.endsWith('_ADMIN'))

    expect(managerRoles).toContain('ROLE_SET_ADDR')
    expect(managerRoles).toContain('ROLE_SET_TEXT')
    expect(managerRoles).toContain('ROLE_SET_CONTENTHASH')
    expect(managerRoles).toContain('ROLE_SET_PUBKEY')
    expect(managerRoles).toContain('ROLE_SET_ABI')
    expect(managerRoles).toContain('ROLE_SET_INTERFACE')
    expect(managerRoles).toContain('ROLE_SET_NAME')
    expect(managerRoles).toContain('ROLE_SET_ALIAS')
    expect(managerRoles).toContain('ROLE_CLEAR')
    expect(managerRoles).toContain('ROLE_UPGRADE')
    expect(managerRoles).toHaveLength(10)

    expect(adminRoles).toContain('ROLE_SET_ADDR_ADMIN')
    expect(adminRoles).toContain('ROLE_SET_TEXT_ADMIN')
    expect(adminRoles).toContain('ROLE_SET_ALIAS_ADMIN')
    expect(adminRoles).toContain('ROLE_UPGRADE_ADMIN')
    expect(adminRoles.length).toBeGreaterThan(0)
  })

  it('should not confuse resolver roles with registry roles at the same bit position', () => {
    const bit28 = 1n << 28n
    const result = decodeResolverRoleBitmap(bit28)

    expect(result).toContain('ROLE_SET_ALIAS')
    expect(result).not.toContain('ROLE_CAN_TRANSFER')
  })
})

const ROOT_RESOURCE =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const makeRole = (
  account: string,
  bitmap: bigint,
  resource = ROOT_RESOURCE,
) => ({
  account,
  resource,
  roleBitmap: `0x${bitmap.toString(16)}`,
})

describe('groupRolesByAccount', () => {
  it('should group a single role entry', () => {
    const roles = [makeRole('0xABC', resolverRoles.ROLE_SET_ADDR)]
    const result = groupRolesByAccount(roles)

    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('0xabc')
    expect(result[0].roles).toHaveLength(1)
    expect(result[0].decodedRoles).toContain('ROLE_SET_ADDR')
  })

  it('should merge multiple entries for the same account', () => {
    const roles = [
      makeRole('0xABC', resolverRoles.ROLE_SET_ADDR),
      makeRole('0xABC', resolverRoles.ROLE_SET_TEXT),
    ]
    const result = groupRolesByAccount(roles)

    expect(result).toHaveLength(1)
    expect(result[0].roles).toHaveLength(2)
    expect(result[0].decodedRoles).toContain('ROLE_SET_ADDR')
    expect(result[0].decodedRoles).toContain('ROLE_SET_TEXT')
  })

  it('should keep different accounts separate', () => {
    const roles = [
      makeRole('0xABC', resolverRoles.ROLE_SET_ADDR),
      makeRole('0xDEF', resolverRoles.ROLE_SET_TEXT),
    ]
    const result = groupRolesByAccount(roles)

    expect(result).toHaveLength(2)
    expect(result[0].account).toBe('0xabc')
    expect(result[1].account).toBe('0xdef')
  })

  it('should normalize account addresses to lowercase', () => {
    const roles = [
      makeRole('0xAbCdEf', resolverRoles.ROLE_SET_ADDR),
      makeRole('0xABCDEF', resolverRoles.ROLE_SET_TEXT),
    ]
    const result = groupRolesByAccount(roles)

    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('0xabcdef')
  })

  it('should decode all roles from a combined bitmap', () => {
    const bitmap =
      resolverRoles.ROLE_SET_ALIAS |
      resolverRoles.ROLE_SET_ALIAS_ADMIN |
      resolverRoles.ROLE_CLEAR
    const roles = [makeRole('0xABC', bitmap)]
    const result = groupRolesByAccount(roles)

    expect(result[0].decodedRoles).toContain('ROLE_SET_ALIAS')
    expect(result[0].decodedRoles).toContain('ROLE_SET_ALIAS_ADMIN')
    expect(result[0].decodedRoles).toContain('ROLE_CLEAR')
  })

  it('should merge the same account across resources', () => {
    const resourceB =
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    const roles = [
      makeRole('0xABC', resolverRoles.ROLE_SET_ADDR),
      makeRole('0xABC', resolverRoles.ROLE_SET_TEXT, resourceB),
    ]
    const result = groupRolesByAccount(roles)

    expect(result).toHaveLength(1)
    expect(result[0].roles).toHaveLength(2)
    expect(result[0].decodedRoles).toEqual(['ROLE_SET_ADDR', 'ROLE_SET_TEXT'])
  })

  it('should return empty array for empty input', () => {
    expect(groupRolesByAccount([])).toEqual([])
  })
})
