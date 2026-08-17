import { describe, expect, it } from 'vitest'
import { isManagerRoleSettable, permissions } from './permissions'

describe('permissions', () => {
  it('should match snapshot with all permissions, titles, and descriptions', () => {
    expect(permissions).toMatchInlineSnapshot(`
      [
        {
          "description": "Can renew name registrations",
          "key": "ROLE_RENEW",
          "title": "Renew",
        },
        {
          "description": "Can change subregistry addresses",
          "key": "ROLE_SET_SUBREGISTRY",
          "title": "Set Subregistry",
        },
        {
          "description": "Can change the resolver addresses",
          "key": "ROLE_SET_RESOLVER",
          "title": "Set Resolver",
        },
        {
          "description": "Can unregister (delete) the name",
          "key": "ROLE_UNREGISTER",
          "title": "Unregister",
        },
      ]
    `)
  })

  it('should only allow manager assignment for settable roles', () => {
    expect(isManagerRoleSettable('ROLE_SET_RESOLVER')).toBe(true)
    expect(isManagerRoleSettable('ROLE_SET_SUBREGISTRY')).toBe(true)
    expect(isManagerRoleSettable('ROLE_RENEW')).toBe(false)
    expect(isManagerRoleSettable('ROLE_UNREGISTER')).toBe(true)
  })

  it('should disable ROLE_UNREGISTER for 2LDs', () => {
    expect(isManagerRoleSettable('ROLE_UNREGISTER', { is2LD: true })).toBe(
      false,
    )
    expect(isManagerRoleSettable('ROLE_UNREGISTER', { is2LD: false })).toBe(
      true,
    )
    // other roles unaffected by 2LD context
    expect(isManagerRoleSettable('ROLE_SET_RESOLVER', { is2LD: true })).toBe(
      true,
    )
    expect(isManagerRoleSettable('ROLE_SET_SUBREGISTRY', { is2LD: true })).toBe(
      true,
    )
  })
})
