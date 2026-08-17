/**
 * Pure ENS owner resolution shared between the React app (useEnsOwner) and the
 * SSR/OG-image worker (worker/ens.ts).
 *
 * Has no wagmi / tanstack-query / neverthrow / React dependencies so it is safe
 * to import into the Cloudflare Workers bundle. Pass any viem Client whose chain
 * has been extended with the ENS contracts (e.g. `extendChainWithEns(sepolia)`).
 */
import type { sepoliaWithEns } from '@ens-apps/indexer/chain'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { getOwner as getOwnerV1 } from '@ensdomains/ensjs/public/v1'
import {
  getNameRegistries,
  getOwner as getOwnerV2,
} from '@ensdomains/ensjs/public/v2'
import { type Address, type Client, type Transport, zeroAddress } from 'viem'

import type { ProtocolVersion } from '@/utils/types'

export type ResolvedEnsOwner = {
  owner: Address
  registryAddress: Address
  protocolVersion: ProtocolVersion
} | null

// A viem Client whose chain carries the ENS contract addresses (sepoliaWithEns).
type EnsResolveClient = Client<Transport, typeof sepoliaWithEns>

/**
 * Resolve the owner of an `.eth` name (or subname) from the V2 registry.
 *
 * The UniversalResolver V2 walks the registry tree on-chain, so both the owner
 * and the name's ancestry of registries are read directly by name at any depth,
 * with no manual per-label `getSubregistry` walk. `getOwner` calls `findOwner`;
 * `getNameRegistries` calls `findRegistries`, which returns the registries
 * leaf-first: `[registryOf(leaf), registryContaining(leaf), ..., root]`. The
 * registry the leaf label actually lives in (what callers like roles, resolver
 * and token key off) is therefore index 1.
 *
 * Both reads are independent and fired together so the client's batching
 * coalesces them into a single request. Returns `null` if the name is unowned
 * or any ancestor registry along the path is missing.
 */
async function resolveV2EthOwner(
  client: EnsResolveClient,
  name: string,
): Promise<{ owner: Address; registryAddress: Address } | null> {
  const [v2Owner, registries] = await Promise.all([
    getOwnerV2(client, { name }),
    getNameRegistries(client, { name }),
  ])

  if (!v2Owner || v2Owner === zeroAddress) return null

  // Index 1 is the registry that contains the leaf label (its parent's
  // subregistry); index 0 is the leaf's *own* subregistry, which is the zero
  // address for a leaf that has no children of its own.
  const registryAddress = registries[1]
  if (!registryAddress || registryAddress === zeroAddress) return null

  return { owner: v2Owner, registryAddress }
}

/**
 * Resolve the owner of an ENS name across the V2 and V1 registries.
 *
 * V2 is tried first, but only for `.eth` names — the V2 registry is rooted at
 * `.eth`, so traversing it for a non-`.eth` name (e.g. `florin.xyz`) would
 * incorrectly resolve against the `.eth` namespace. Falls back to the V1
 * registry. Returns `null` when the name is unowned in both.
 */
export async function resolveEnsOwner(
  client: EnsResolveClient,
  name: string,
): Promise<ResolvedEnsOwner> {
  const v1EthRegistry = getChainContractAddress({
    chain: client.chain,
    contract: 'ensLegacyRegistry',
  })

  const labels = name.split('.')
  const tld = labels[labels.length - 1]

  if (tld === 'eth' && labels.length >= 2) {
    const v2 = await resolveV2EthOwner(client, name)
    if (v2) {
      return {
        owner: v2.owner,
        registryAddress: v2.registryAddress,
        protocolVersion: 'ENSv2',
      }
    }
  }

  const v1Owner = await getOwnerV1(client, { name })
  if (v1Owner?.owner && v1Owner.owner !== zeroAddress) {
    return {
      owner: v1Owner.owner,
      registryAddress: v1EthRegistry,
      protocolVersion: 'ENSv1',
    }
  }

  return null
}
