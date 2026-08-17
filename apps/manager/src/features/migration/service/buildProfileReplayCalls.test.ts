import { type Address, decodeFunctionData, type Hex } from 'viem'
import { assert, describe, expect, it } from 'vitest'
import { PERMISSIONED_RESOLVER_ABI } from '../contracts/abis'
import {
  flattenProfileInnerCalls,
  wrapInnerCallsAsMulticall,
} from './buildProfileReplayCalls'
import type { Profile } from './fetchV1Profiles'

const RESOLVER: Address = '0x000000000000000000000000000000000000d002'
const NODE: Hex =
  '0x1111111111111111111111111111111111111111111111111111111111111111'

describe('buildProfileReplayCalls helpers', () => {
  it('flattens no calls for empty profiles', () => {
    expect(flattenProfileInnerCalls(new Map())).toEqual([])
    expect(
      flattenProfileInnerCalls(
        new Map<Hex, Profile>([
          [NODE, { texts: [], addresses: [], contentHash: null, abis: [] }],
        ]),
      ),
    ).toEqual([])
  })

  it('flattens every supported record and wraps them in resolver.multicall(bytes[])', () => {
    const profile: Profile = {
      texts: [{ key: 'email', value: 'a@b.c' }],
      addresses: [
        {
          coinType: 60n,
          value: '0x0000000000000000000000000000000000000abc' as Hex,
        },
      ],
      contentHash: '0xe301' as Hex,
      abis: [{ contentType: 1n, value: '0x5b5d' as Hex }],
    }
    const innerCalls = flattenProfileInnerCalls(
      new Map<Hex, Profile>([[NODE, profile]]),
    )
    expect(innerCalls).toHaveLength(4)

    const call = wrapInnerCallsAsMulticall(RESOLVER, innerCalls)
    expect(call.to).toBe(RESOLVER)
    expect(call.value).toBe(0n)

    const { functionName, args } = decodeFunctionData({
      abi: PERMISSIONED_RESOLVER_ABI,
      data: call.data,
    })
    expect(functionName).toBe('multicall')
    const [wrappedInnerCalls] = args as [readonly Hex[]]
    expect(wrappedInnerCalls).toEqual(innerCalls)
    const [firstInner, secondInner, thirdInner, fourthInner] = wrappedInnerCalls
    assert(firstInner && secondInner && thirdInner && fourthInner)

    const setText = decodeFunctionData({
      abi: PERMISSIONED_RESOLVER_ABI,
      data: firstInner,
    })
    expect(setText.functionName).toBe('setText')
    expect((setText.args as [Hex, string, string])[1]).toBe('email')

    const setAddr = decodeFunctionData({
      abi: PERMISSIONED_RESOLVER_ABI,
      data: secondInner,
    })
    expect(setAddr.functionName).toBe('setAddr')
    expect((setAddr.args as [Hex, bigint, Hex])[1]).toBe(60n)

    const setContenthash = decodeFunctionData({
      abi: PERMISSIONED_RESOLVER_ABI,
      data: thirdInner,
    })
    expect(setContenthash.functionName).toBe('setContenthash')
    expect((setContenthash.args as [Hex, Hex])[1]).toBe('0xe301')

    const setAbi = decodeFunctionData({
      abi: PERMISSIONED_RESOLVER_ABI,
      data: fourthInner,
    })
    expect(setAbi.functionName).toBe('setABI')
    expect((setAbi.args as [Hex, bigint, Hex]).slice(1)).toEqual([1n, '0x5b5d'])
  })
})
