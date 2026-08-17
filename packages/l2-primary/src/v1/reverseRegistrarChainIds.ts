/**
 * L2 Reverse Registrar contract addresses (ENSv1)
 *
 * Mapping of reverse-registrar keys (mainnet chain ids, plus the `1`/`60` L1
 * aliases) to per-environment chain ids and contract addresses.
 *
 * NOTE: ENSIP-11 coin types are NOT the same across mainnet and testnet for
 * L2s. The Sepolia deployment keys everything on the TESTNET chain-id coin
 * type — e.g. the OP Sepolia `L2ReverseRegistrar.coinType()` returns
 * `0x80000000 | 11155420`, and the Sepolia L1 registry only has resolvers for
 * `<hex(0x80000000 | testnetChainId)>.reverse` namespaces (the mainnet-derived
 * ones are unset). The one exception is L1 itself: the deployed contracts
 * treat L1 testnets as mainnet clones, so Sepolia L1 uses coin type `60`.
 * Use {@link getCoinTypeForReverseRegistrarChainId} to derive the coin type
 * for an environment.
 */

import type { Address, Chain } from 'viem'

export type ReverseRegistrarChainId =
  | 1
  | 60
  | 10
  | 42161
  | 8453
  | 59144
  | 534352

export type NetworkKey = 'mainnet' | 'sepolia'

export function resolveNetworkFromChain(chain?: Chain): NetworkKey {
  switch (chain?.id) {
    case 1:
      return 'mainnet'
    case 11155111:
      return 'sepolia'
    default:
      return 'sepolia'
  }
}

export const REVERSE_REGISTRAR_CHAIN_IDS: Record<
  ReverseRegistrarChainId,
  { mainnet: number; sepolia: number }
> = {
  1: { mainnet: 1, sepolia: 11155111 },
  60: { mainnet: 1, sepolia: 11155111 },
  10: { mainnet: 10, sepolia: 11155420 },
  42161: { mainnet: 42161, sepolia: 421614 },
  8453: { mainnet: 8453, sepolia: 84532 },
  59144: { mainnet: 59144, sepolia: 59141 },
  534352: { mainnet: 534352, sepolia: 534351 },
}

export const L2_REVERSE_REGISTRARS: Record<
  ReverseRegistrarChainId,
  { mainnet?: Address; sepolia?: Address }
> = {
  // ENSv1 ReverseRegistrar on L1. Addresses sourced from
  // `ens-contracts/deployments/{mainnet,sepolia}/ReverseRegistrar.json`.
  1: {
    mainnet: '0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb',
    sepolia: '0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6',
  },
  60: {
    mainnet: '0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb',
    sepolia: '0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6',
  },
  // ENSv1 L2ReverseRegistrar on L2 chains. The contract is deployed at the
  // same address on every supported L2 within a given environment (via
  // CREATE2 / deterministic deployment). Addresses sourced from
  // `ens-contracts/deployments/{optimism,arbitrum,base,linea,scroll}{,Sepolia}/L2ReverseRegistrar.json`
  // and verified on-chain by reading `coinType()` against the ENSIP-19
  // chain coin type.
  10: {
    mainnet: '0x0000000000D8e504002cC26E3Ec46D81971C1664',
    sepolia: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  },
  42161: {
    mainnet: '0x0000000000D8e504002cC26E3Ec46D81971C1664',
    sepolia: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  },
  8453: {
    mainnet: '0x0000000000D8e504002cC26E3Ec46D81971C1664',
    sepolia: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  },
  59144: {
    mainnet: '0x0000000000D8e504002cC26E3Ec46D81971C1664',
    sepolia: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  },
  534352: {
    mainnet: '0x0000000000D8e504002cC26E3Ec46D81971C1664',
    sepolia: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  },
} as const satisfies Record<
  ReverseRegistrarChainId,
  { mainnet?: Address; sepolia?: Address }
>

export function getRegistrarAddress<
  CT extends ReverseRegistrarChainId,
  N extends NetworkKey = 'sepolia',
>(coinType: CT, network?: N): (typeof L2_REVERSE_REGISTRARS)[CT][N] {
  const net = (network ?? 'sepolia') as N
  return L2_REVERSE_REGISTRARS[coinType][net]
}

export function getChainIdForReverseRegistrarChainId<
  CT extends ReverseRegistrarChainId,
  N extends NetworkKey = 'sepolia',
>(coinType: CT, network?: N): (typeof REVERSE_REGISTRAR_CHAIN_IDS)[CT][N] {
  const net = (network ?? 'sepolia') as N
  return REVERSE_REGISTRAR_CHAIN_IDS[coinType][net]
}

/**
 * ENSIP-11 / ENSIP-19 coin type for a reverse-registrar key in a given
 * environment.
 *
 * - L1 keys (`1` / `60`) → `60`: the deployed contracts treat L1 testnets as
 *   mainnet clones (Sepolia's `addr.reverse` is keyed on coin 60, NOT on
 *   `0x80000000 | 11155111`).
 * - L2 keys → `0x80000000 | <environment chain id>` (ENSIP-11): on Sepolia
 *   this is derived from the TESTNET chain id (e.g. Base →
 *   `0x80000000 | 84532`), matching the on-chain `L2ReverseRegistrar.coinType()`
 *   and the `<hex(coinType)>.reverse` namespaces that exist in the Sepolia
 *   registry.
 */
export function getCoinTypeForReverseRegistrarChainId(
  reverseRegistrarChainId: ReverseRegistrarChainId,
  network?: NetworkKey,
): number {
  if (reverseRegistrarChainId === 1 || reverseRegistrarChainId === 60) return 60
  const chainId = getChainIdForReverseRegistrarChainId(
    reverseRegistrarChainId,
    network ?? 'sepolia',
  )
  // ENSIP-11: coinType = 0x80000000 | chainId. `>>> 0` keeps it an unsigned
  // 32-bit number (bitwise OR would otherwise produce a negative int32).
  return (0x80000000 | chainId) >>> 0
}
