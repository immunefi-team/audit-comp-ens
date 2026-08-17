import { describe, expect, it } from 'vitest'
import {
  computeRoleChanges,
  hasPermissionsChanged,
  roleToPermissions,
} from './rolesToPermissions'

describe('roleToPermissions', () => {
  it('should map manager roles (without _ADMIN suffix)', () => {
    const result = roleToPermissions(['ROLE_RENEW', 'ROLE_SET_RESOLVER'])

    expect(result.get('ROLE_RENEW')).toEqual({
      admin: false,
      manager: true,
    })
    expect(result.get('ROLE_SET_RESOLVER')).toEqual({
      admin: false,
      manager: true,
    })
  })

  it('should map admin roles (with _ADMIN suffix)', () => {
    const result = roleToPermissions([
      'ROLE_RENEW_ADMIN',
      'ROLE_UNREGISTER_ADMIN',
    ])

    expect(result.get('ROLE_RENEW')).toEqual({
      admin: true,
      manager: false,
    })
    expect(result.get('ROLE_UNREGISTER')).toEqual({
      admin: true,
      manager: false,
    })
  })

  it('should merge admin and manager for same role', () => {
    const result = roleToPermissions(['ROLE_RENEW', 'ROLE_RENEW_ADMIN'])

    expect(result.get('ROLE_RENEW')).toEqual({
      admin: true,
      manager: true,
    })
  })

  it('should handle empty array', () => {
    expect(roleToPermissions([]).size).toBe(0)
  })
})

describe('hasPermissionsChanged', () => {
  it('should return false when permissions are identical', () => {
    const original = roleToPermissions(['owner_ADMIN', 'owner'])
    const edited = roleToPermissions(['owner_ADMIN', 'owner'])

    expect(hasPermissionsChanged(original, edited)).toBe(false)
  })

  it('should return true when admin permission changed', () => {
    const original = roleToPermissions(['owner_ADMIN'])
    const edited = roleToPermissions([])

    expect(hasPermissionsChanged(original, edited)).toBe(true)
  })

  it('should return true when manager permission added', () => {
    const original = roleToPermissions([])
    const edited = roleToPermissions(['owner'])

    expect(hasPermissionsChanged(original, edited)).toBe(true)
  })

  it('should return true when new role added', () => {
    const original = roleToPermissions(['owner_ADMIN'])
    const edited = roleToPermissions(['owner_ADMIN', 'manager'])

    expect(hasPermissionsChanged(original, edited)).toBe(true)
  })

  it('should return false for empty maps', () => {
    const original = new Map()
    const edited = new Map()

    expect(hasPermissionsChanged(original, edited)).toBe(false)
  })

  it('should return true when edited has fewer roles', () => {
    const original = roleToPermissions(['owner_ADMIN', 'manager'])
    const edited = roleToPermissions(['owner_ADMIN'])

    expect(hasPermissionsChanged(original, edited)).toBe(true)
  })
})

describe('computeRoleChanges', () => {
  it('should return empty arrays when no changes', () => {
    const originalRoles = ['owner_ADMIN', 'owner']
    const editedPermissions = roleToPermissions(originalRoles)

    const result = computeRoleChanges(originalRoles, editedPermissions)

    expect(result.rolesToGrant).toEqual([])
    expect(result.rolesToRevoke).toEqual([])
  })

  it('should identify role to grant', () => {
    const originalRoles: string[] = []
    const editedPermissions = roleToPermissions(['owner'])

    const result = computeRoleChanges(originalRoles, editedPermissions)

    expect(result.rolesToGrant).toContain('owner')
    expect(result.rolesToRevoke).toEqual([])
  })

  it('should identify role to revoke', () => {
    const originalRoles = ['owner_ADMIN']
    const editedPermissions = roleToPermissions([])

    const result = computeRoleChanges(originalRoles, editedPermissions)

    expect(result.rolesToRevoke).toContain('owner_ADMIN')
    expect(result.rolesToGrant).toEqual([])
  })

  it('should identify both grant and revoke changes', () => {
    const originalRoles = ['owner_ADMIN', 'manager']
    const editedPermissions = roleToPermissions(['owner', 'manager_ADMIN'])

    const result = computeRoleChanges(originalRoles, editedPermissions)

    expect(result.rolesToGrant).toContain('owner')
    expect(result.rolesToRevoke).toContain('owner_ADMIN')
    expect(result.rolesToGrant).toContain('manager_ADMIN')
    expect(result.rolesToRevoke).toContain('manager')
  })

  it('should handle multiple roles at once', () => {
    const originalRoles = ['owner_ADMIN', 'manager_ADMIN']
    const editedPermissions = roleToPermissions(['owner', 'manager'])

    const result = computeRoleChanges(originalRoles, editedPermissions)

    expect(result.rolesToGrant).toEqual(['owner', 'manager'])
    expect(result.rolesToRevoke).toEqual(['owner_ADMIN', 'manager_ADMIN'])
  })

  it('should return empty for empty inputs', () => {
    const result = computeRoleChanges([], new Map())

    expect(result.rolesToGrant).toEqual([])
    expect(result.rolesToRevoke).toEqual([])
  })
})
