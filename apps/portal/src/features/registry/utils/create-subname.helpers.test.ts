import { userRegistryRegisterSnippet } from '@ensdomains/ensjs-abi/v2/userRegistry'
import { type Address, decodeFunctionData } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROLE_BITMAP,
  prepareCreateSubnameTransaction,
} from './create-subname.helpers'

const OWNER: Address = '0x7Bc153b2a4C8a2f3428bd0da77a901b81c6dD809'
const REGISTRY: Address = '0x666b3d735e366bb8755b65cb5bf7a14c7f41eb23'
const RESOLVER: Address = '0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d'

// biome-ignore lint/suspicious/noExplicitAny: minimal wallet client mock
const mockWalletClient = { account: { address: OWNER }, chain: sepolia } as any

function decodeRoleBitmap(data: `0x${string}`): bigint {
  const { args } = decodeFunctionData({
    abi: userRegistryRegisterSnippet,
    data,
  })
  // args: [label, owner, registry, resolver, roleBitmap, expiry]
  return args[4]
}

describe('prepareCreateSubnameTransaction', () => {
  // Regression for WEB-448: subnames were created with an empty (0n) role
  // bitmap, leaving the owner with no roles. The default must grant all roles.
  it('defaults the role bitmap to all roles, never an empty bitmap', () => {
    const { request } = prepareCreateSubnameTransaction({
      registryAddress: REGISTRY,
      label: 'test',
      owner: OWNER,
      resolverAddress: RESOLVER,
      walletClient: mockWalletClient,
      chainId: sepolia.id,
    })

    expect(request.type).toBe('eoa')
    if (request.type !== 'eoa') throw new Error('expected an EOA request')

    const { data } = request
    expect(data).toBeDefined()
    expect(decodeRoleBitmap(data as `0x${string}`)).toBe(DEFAULT_ROLE_BITMAP)
    expect(DEFAULT_ROLE_BITMAP).not.toBe(0n)
  })
})
