import { registryRoles } from '@ensdomains/ensjs/utils/v2'
import { describe, expect, it } from 'vitest'
import { decodeRoleBitmap } from './decodeRoleBitmap'

describe('decodeRoleBitmap', () => {
  it('should decode a single role from bitmap', () => {
    const bitmap = registryRoles.ROLE_RENEW
    const result = decodeRoleBitmap(bitmap)

    expect(result).toContain('ROLE_RENEW')
    expect(result).toHaveLength(1)
  })

  it('should decode multiple roles from bitmap', () => {
    const bitmap = registryRoles.ROLE_RENEW | registryRoles.ROLE_UNREGISTER
    const result = decodeRoleBitmap(bitmap)

    expect(result).toContain('ROLE_RENEW')
    expect(result).toContain('ROLE_UNREGISTER')
    expect(result).toHaveLength(2)
  })

  it('should decode admin roles from bitmap', () => {
    const bitmap =
      registryRoles.ROLE_RENEW_ADMIN | registryRoles.ROLE_UNREGISTER_ADMIN
    const result = decodeRoleBitmap(bitmap)

    expect(result).toContain('ROLE_RENEW_ADMIN')
    expect(result).toContain('ROLE_UNREGISTER_ADMIN')
    expect(result).toHaveLength(2)
  })

  it('should handle string bitmap input', () => {
    const bitmap = (
      registryRoles.ROLE_RENEW | registryRoles.ROLE_UNREGISTER
    ).toString()
    const result = decodeRoleBitmap(bitmap)

    expect(result).toContain('ROLE_RENEW')
    expect(result).toContain('ROLE_UNREGISTER')
  })

  it('should handle hex string bitmap input', () => {
    const bitmap = `0x${(registryRoles.ROLE_RENEW | registryRoles.ROLE_UNREGISTER).toString(16)}`
    const result = decodeRoleBitmap(bitmap)

    expect(result).toContain('ROLE_RENEW')
    expect(result).toContain('ROLE_UNREGISTER')
  })

  it('should return empty array for zero bitmap', () => {
    expect(decodeRoleBitmap(0n)).toEqual([])
    expect(decodeRoleBitmap('0')).toEqual([])
    expect(decodeRoleBitmap('0x0')).toEqual([])
  })
})
