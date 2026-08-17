import { type Address, decodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import { ETH_REGISTRY_V2_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import { makeClassified } from './_fixtures'
import { buildRoleGrantCall } from './buildRoleGrantCalls'

const MANAGER: Address = '0x0000000000000000000000000000000000000099'
const ROLE_SET_RESOLVER = 1n << 24n

describe('buildRoleGrantCall', () => {
  it('targets the v2 ETHRegistry with ROLE_SET_RESOLVER for the manager', () => {
    const call = buildRoleGrantCall(
      makeClassified({
        managerAddress: MANAGER,
        label: 'bob',
        name: 'bob.eth',
      }),
    )
    expect(call.to).toBe(V2_CONTRACTS.ETHRegistry)
    expect(call.value).toBe(0n)

    const { functionName, args } = decodeFunctionData({
      abi: ETH_REGISTRY_V2_ABI,
      data: call.data,
    })
    expect(functionName).toBe('grantRoles')
    const [, roles, account] = args as [bigint, bigint, Address]
    expect(roles).toBe(ROLE_SET_RESOLVER)
    expect(account.toLowerCase()).toBe(MANAGER.toLowerCase())
  })

  it('throws when manager is null', () => {
    expect(() => buildRoleGrantCall(makeClassified())).toThrow(
      /No manager address/i,
    )
  })
})
