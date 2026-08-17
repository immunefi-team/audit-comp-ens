import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRoleTransactions } from './buildRoleTransactions'

const TEST_ACCOUNT = '0x1234567890123456789012345678901234567890' as const
const TEST_ACCOUNT_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const TEST_REGISTRY = '0x1111111111111111111111111111111111111111' as const

describe('buildRoleTransactions', () => {
  const mockHandlers = {
    grantRoles: vi.fn(),
    revokeRoles: vi.fn(),
    handleDone: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no pending state', () => {
    const result = buildRoleTransactions(
      null,
      null,
      'test.eth',
      mockHandlers,
      TEST_REGISTRY,
    )
    expect(result).toEqual([])
    expect(mockHandlers.grantRoles).not.toHaveBeenCalled()
    expect(mockHandlers.revokeRoles).not.toHaveBeenCalled()
    expect(mockHandlers.handleDone).not.toHaveBeenCalled()
  })

  it('returns transaction with correct structure for single grant', () => {
    const result = buildRoleTransactions(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: ['ROLE_RENEW'],
        rolesToRevoke: [],
      },
      null,
      'test.eth',
      mockHandlers,
      TEST_REGISTRY,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'tx-grant-roles',
      title: 'Grant roles',
      transactionName: 'Grant roles for 0x1234…7890',
    })
    expect(typeof result[0].onStart).toBe('function')
    expect(typeof result[0].onDone).toBe('function')

    result[0].onStart()
    expect(mockHandlers.grantRoles).toHaveBeenCalledWith({
      name: 'test.eth',
      account: TEST_ACCOUNT,
      roles: ['ROLE_RENEW'],
      id: 'tx-grant-roles',
      registryAddress: TEST_REGISTRY,
    })

    result[0].onDone()
    expect(mockHandlers.handleDone).toHaveBeenCalled()
  })

  it('chains grant onDone to revoke when both present', () => {
    const result = buildRoleTransactions(
      {
        account: TEST_ACCOUNT,
        rolesToGrant: ['ROLE_RENEW'],
        rolesToRevoke: ['ROLE_UNREGISTER'],
      },
      null,
      'example.eth',
      mockHandlers,
      TEST_REGISTRY,
    )

    expect(result).toHaveLength(2)

    result[0].onDone()
    expect(mockHandlers.revokeRoles).toHaveBeenCalledWith({
      name: 'example.eth',
      account: TEST_ACCOUNT,
      roles: ['ROLE_UNREGISTER'],
      id: 'tx-revoke-roles',
      registryAddress: TEST_REGISTRY,
    })
    expect(mockHandlers.handleDone).not.toHaveBeenCalled()

    result[1].onDone()
    expect(mockHandlers.handleDone).toHaveBeenCalled()
  })

  it('returns remove user transaction for pendingRemove', () => {
    const result = buildRoleTransactions(
      null,
      { account: TEST_ACCOUNT_2, roles: ['ROLE_UNREGISTER'] },
      'parent.eth',
      mockHandlers,
      TEST_REGISTRY,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'tx-revoke-roles',
      title: 'Remove user',
      transactionName: 'Remove 0xabcd…abcd from parent.eth',
    })

    result[0].onStart()
    expect(mockHandlers.revokeRoles).toHaveBeenCalledWith({
      name: 'parent.eth',
      account: TEST_ACCOUNT_2,
      roles: ['ROLE_UNREGISTER'],
      id: 'tx-revoke-roles',
      registryAddress: TEST_REGISTRY,
    })
  })
})
