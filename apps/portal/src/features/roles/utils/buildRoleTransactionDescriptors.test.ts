import type { Role } from '@ensdomains/ensjs/utils/v2'
import { describe, expect, it } from 'vitest'
import { buildRoleTransactionDescriptors } from './buildRoleTransactionDescriptors'

const TEST_ACCOUNT = '0x1234567890123456789012345678901234567890' as const
const TEST_ACCOUNT_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

describe('buildRoleTransactionDescriptors', () => {
  it('returns empty array when both pendingSave and pendingRemove are null', () => {
    const result = buildRoleTransactionDescriptors(null, null, 'test.eth')
    expect(result).toEqual([])
  })

  it('returns empty array when pendingSave has no roles to grant or revoke', () => {
    const result = buildRoleTransactionDescriptors(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: [],
        rolesToRevoke: [],
      },
      null,
      'test.eth',
    )
    expect(result).toEqual([])
  })

  it('returns single grant descriptor when only roles to grant', () => {
    const roles: readonly Role[] = ['ROLE_RENEW', 'ROLE_SET_RESOLVER']
    const result = buildRoleTransactionDescriptors(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: roles,
        rolesToRevoke: [],
      },
      null,
      'test.eth',
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'tx-grant-roles',
      title: 'Grant roles',
      transactionName: 'Grant roles for 0x1234…7890',
      type: 'grant',
      account: TEST_ACCOUNT,
      roles,
    })
  })

  it('returns single revoke descriptor when only roles to revoke', () => {
    const roles: readonly Role[] = ['ROLE_RENEW', 'ROLE_UNREGISTER']
    const result = buildRoleTransactionDescriptors(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: [],
        rolesToRevoke: roles,
      },
      null,
      'myname.eth',
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'tx-revoke-roles',
      title: 'Revoke roles',
      transactionName: 'Revoke roles for 0x1234…7890',
      type: 'revoke',
      account: TEST_ACCOUNT,
      roles,
    })
  })

  it('returns grant then revoke descriptors when both present', () => {
    const toGrant: readonly Role[] = ['ROLE_RENEW']
    const toRevoke: readonly Role[] = ['ROLE_UNREGISTER']
    const result = buildRoleTransactionDescriptors(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: toGrant,
        rolesToRevoke: toRevoke,
      },
      null,
      'example.eth',
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'tx-grant-roles',
      title: 'Grant roles',
      transactionName: 'Grant roles for 0x1234…7890',
      type: 'grant',
      account: TEST_ACCOUNT,
      roles: toGrant,
    })
    expect(result[1]).toEqual({
      id: 'tx-revoke-roles',
      title: 'Revoke roles',
      transactionName: 'Revoke roles for 0x1234…7890',
      type: 'revoke',
      account: TEST_ACCOUNT,
      roles: toRevoke,
    })
  })

  it('returns remove user descriptor when pendingRemove', () => {
    const roles: readonly Role[] = ['ROLE_RENEW', 'ROLE_SET_RESOLVER']
    const result = buildRoleTransactionDescriptors(
      null,
      {
        account: TEST_ACCOUNT_2,
        roles,
      },
      'parent.eth',
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'tx-revoke-roles',
      title: 'Remove user',
      transactionName: 'Remove 0xabcd…abcd from parent.eth',
      type: 'revoke',
      account: TEST_ACCOUNT_2,
      roles,
    })
  })

  it('prioritizes pendingSave over pendingRemove when both provided', () => {
    const result = buildRoleTransactionDescriptors(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: ['ROLE_RENEW'],
        rolesToRevoke: [],
      },
      {
        account: TEST_ACCOUNT_2,
        roles: ['ROLE_UNREGISTER'],
      },
      'test.eth',
    )

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('grant')
    expect(result[0].account).toBe(TEST_ACCOUNT)
  })
})
