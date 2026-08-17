import type { Address, Hex } from 'viem'
import { PERMISSIONED_RESOLVER_ABI } from '../contracts/abis'
import type { Profile } from './fetchV1Profiles'

export type NameForFetch = {
  readonly nodeHex: Hex
  readonly v1ResolverAddress: Address
}

export type ProfileKeyEntry = {
  readonly id: string
  readonly texts: readonly string[]
  readonly coinTypes: readonly number[]
  readonly contentHash: string | null
  readonly abiContentTypes: readonly bigint[]
}

export type ResolverCall =
  | { readonly name: NameForFetch; readonly kind: 'text'; readonly key: string }
  | {
      readonly name: NameForFetch
      readonly kind: 'addr'
      readonly coinType: bigint
    }
  | { readonly name: NameForFetch; readonly kind: 'contenthash' }
  | {
      readonly name: NameForFetch
      readonly kind: 'abi'
      readonly contentType: bigint
    }

export type MulticallContract = {
  readonly address: Address
  readonly abi: typeof PERMISSIONED_RESOLVER_ABI
  readonly functionName: 'text' | 'addr' | 'contenthash' | 'ABI'
  readonly args: readonly unknown[]
}

export type MulticallResult = {
  readonly status: 'success' | 'failure'
  readonly result?: unknown
  readonly error?: unknown
}

export const profileMapKey = (nodeHex: Hex): Hex => nodeHex.toLowerCase() as Hex

export const indexNamesByNode = (
  names: readonly NameForFetch[],
): Map<Hex, NameForFetch> =>
  new Map(names.map((n) => [profileMapKey(n.nodeHex), n]))

export const buildProfileMulticallPlan = (
  keyEntries: readonly ProfileKeyEntry[],
  byNode: ReadonlyMap<Hex, NameForFetch>,
): {
  readonly calls: ResolverCall[]
  readonly contracts: MulticallContract[]
} => {
  const calls: ResolverCall[] = []
  const contracts: MulticallContract[] = []

  for (const entry of keyEntries) {
    const name = byNode.get(profileMapKey(entry.id as Hex))
    if (!name) continue
    for (const key of entry.texts) {
      calls.push({ name, kind: 'text', key })
      contracts.push({
        address: name.v1ResolverAddress,
        abi: PERMISSIONED_RESOLVER_ABI,
        functionName: 'text',
        args: [name.nodeHex, key],
      })
    }
    for (const ct of entry.coinTypes) {
      const coinType = BigInt(ct)
      calls.push({ name, kind: 'addr', coinType })
      contracts.push({
        address: name.v1ResolverAddress,
        abi: PERMISSIONED_RESOLVER_ABI,
        functionName: 'addr',
        args: [name.nodeHex, coinType],
      })
    }
    if (entry.contentHash && entry.contentHash !== '0x') {
      calls.push({ name, kind: 'contenthash' })
      contracts.push({
        address: name.v1ResolverAddress,
        abi: PERMISSIONED_RESOLVER_ABI,
        functionName: 'contenthash',
        args: [name.nodeHex],
      })
    }
    for (const contentType of new Set(entry.abiContentTypes)) {
      calls.push({ name, kind: 'abi', contentType })
      contracts.push({
        address: name.v1ResolverAddress,
        abi: PERMISSIONED_RESOLVER_ABI,
        functionName: 'ABI',
        args: [name.nodeHex, contentType],
      })
    }
  }
  return { calls, contracts }
}

export const initEmptyProfileBuckets = (
  byNode: ReadonlyMap<Hex, NameForFetch>,
): Map<Hex, Profile> => {
  const out = new Map<Hex, Profile>()
  for (const [, name] of byNode) {
    out.set(profileMapKey(name.nodeHex), {
      texts: [],
      addresses: [],
      contentHash: null,
      abis: [],
    })
  }
  return out
}

export const mergeMulticallResultsIntoProfiles = (params: {
  readonly buckets: Map<Hex, Profile>
  readonly calls: readonly ResolverCall[]
  readonly results: readonly MulticallResult[]
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: text and address result handling intentionally share one index-aligned multicall pass.
}): Map<Hex, Profile> => {
  const { buckets, calls, results } = params
  for (const [i, call] of calls.entries()) {
    const res = results[i]
    if (res?.status !== 'success') continue
    const bucket = buckets.get(profileMapKey(call.name.nodeHex))
    if (!bucket) continue
    const nodeKey = profileMapKey(call.name.nodeHex)
    switch (call.kind) {
      case 'text': {
        const value = res.result as string
        if (value) {
          buckets.set(nodeKey, {
            ...bucket,
            texts: [...bucket.texts, { key: call.key, value }],
          })
        }
        break
      }
      case 'addr': {
        const value = res.result as Hex
        if (value && value !== '0x') {
          buckets.set(nodeKey, {
            ...bucket,
            addresses: [
              ...bucket.addresses,
              { coinType: call.coinType, value },
            ],
          })
        }
        break
      }
      case 'contenthash': {
        const value = res.result as Hex
        if (value && value !== '0x') {
          buckets.set(nodeKey, { ...bucket, contentHash: value })
        }
        break
      }
      case 'abi': {
        const [contentType, value] = res.result as readonly [bigint, Hex]
        if (contentType !== 0n && value && value !== '0x') {
          buckets.set(nodeKey, {
            ...bucket,
            abis: [...bucket.abis, { contentType, value }],
          })
        }
        break
      }
    }
  }
  return buckets
}
