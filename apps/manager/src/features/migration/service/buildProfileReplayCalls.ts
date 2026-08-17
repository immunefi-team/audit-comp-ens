import type { Call } from '@ens-apps/transaction-manager'
import { type Address, encodeFunctionData, type Hex } from 'viem'
import { PERMISSIONED_RESOLVER_ABI } from '../contracts/abis'
import type { Profile } from './fetchV1Profiles'

export const flattenProfileInnerCalls = (
  profiles: ReadonlyMap<Hex, Profile>,
): Hex[] => {
  const innerCalls: Hex[] = []
  for (const [nodeHex, profile] of profiles) {
    for (const t of profile.texts) {
      innerCalls.push(
        encodeFunctionData({
          abi: PERMISSIONED_RESOLVER_ABI,
          functionName: 'setText',
          args: [nodeHex, t.key, t.value],
        }),
      )
    }
    for (const a of profile.addresses) {
      innerCalls.push(
        encodeFunctionData({
          abi: PERMISSIONED_RESOLVER_ABI,
          functionName: 'setAddr',
          args: [nodeHex, a.coinType, a.value],
        }),
      )
    }
    if (profile.contentHash) {
      innerCalls.push(
        encodeFunctionData({
          abi: PERMISSIONED_RESOLVER_ABI,
          functionName: 'setContenthash',
          args: [nodeHex, profile.contentHash],
        }),
      )
    }
    for (const abiRecord of profile.abis) {
      innerCalls.push(
        encodeFunctionData({
          abi: PERMISSIONED_RESOLVER_ABI,
          functionName: 'setABI',
          args: [nodeHex, abiRecord.contentType, abiRecord.value],
        }),
      )
    }
  }
  return innerCalls
}

export const wrapInnerCallsAsMulticall = (
  resolver: Address,
  innerCalls: readonly Hex[],
): Call => ({
  to: resolver,
  data: encodeFunctionData({
    abi: PERMISSIONED_RESOLVER_ABI,
    functionName: 'multicall',
    args: [innerCalls as Hex[]],
  }),
  value: 0n,
})
