import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import type { Address } from 'viem'
import { zeroAddress, zeroHash } from 'viem'

const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]

export const ENS_SEPOLIA_CONTRACTS = {
  // --- V1 (sourced from ensjs) ---
  ETHRegistrarController: ensjsSepolia.ensEthRegistrarController.address,
  ETHRenewerV1: ensjsSepolia.ensEthRenewerV1.address,
  PublicResolver: ensjsSepolia.ensPublicResolver.address,
  ReverseRegistrar: ensjsSepolia.ensReverseRegistrar.address,
  LegacyRegistry: ensjsSepolia.ensLegacyRegistry.address,

  // --- V2 (sourced from ensjs chain config) ---
  ETHRegistry: ensjsSepolia.ensRegistry.address,
  ETHRegistrar: ensjsSepolia.ensEthRegistrar.address,
  // The V2 resolver implementation proxied by VerifiableFactory. This is
  // `PermissionedResolver` — NOT namechain's `DedicatedResolver`, which is a
  // different contract with its own interface id (0x92349baa).
  PermissionedResolverImpl: ensjsSepolia.ensPermissionedResolverImpl.address,
  VerifiableFactory: ensjsSepolia.ensVerifiableFactory.address,
  StandardRentPriceOracle: ensjsSepolia.ensStandardRentPriceOracle.address,
  HCAFactory: ensjsSepolia.ensHcaFactory.address,

  // --- Not (yet) in ensjs chain definitions; canonical Sepolia V2 deployment ---
  // Default reverse registrar (ENSIP-19 `default.reverse`, sets the
  // primary/default ENS name per coin type). This is the registrar the
  // canonical deployment's DefaultReverseRegistrarAdapter wraps (its public
  // immutable `DEFAULT_REVERSE_REGISTRAR`, read off `0x7a84e241…` on Sepolia)
  // — NOT the superseded `0xeb8269fb…` standalone deployment, whose records
  // nothing in the canonical resolution path reads.
  DefaultReverseRegistrar: '0x4F382928805ba0e23B30cFB75fC9E848e82DFD47',
  // HCA forwarders for the two v1 reverse registrars (canonical deployment,
  // contracts-v2 docs/addresses/sepolia.md @ 97a5729).
  DefaultReverseRegistrarAdapter: '0x7a84e241f862D73960D73c26d68c3C8F89F0B18F',
  ReverseRegistrarAdapter: '0x035ae6188ac22ab79b5018039dFbda4FFe7990e9',
} as const

// Payment tokens the V2 registrar actually accepts (its PAYMENT_TOKEN /
// SECONDARY_PAYMENT_TOKEN slots). DAI is deliberately absent: offering it in a
// picker produces quotes the registrar rejects at settlement.
export const SUPPORTED_TOKENS = {
  USDC: ensjsSepolia.usdc.address,
} as const satisfies Record<'USDC', Address>

// Metadata for every token the apps can price/display. Broader than
// `SUPPORTED_TOKENS` because apps/portal still offers DAI in its own picker.
// Adding an entry here does NOT make it a valid payment token.
export const TOKENS = {
  USDC: {
    address: SUPPORTED_TOKENS.USDC,
    decimals: 6,
    symbol: 'USDC',
  },
  DAI: {
    address: ensjsSepolia.dai.address,
    decimals: 18,
    symbol: 'DAI',
  },
} as const

/** Any token the apps know how to price/display — includes portal's DAI. */
export type TOKEN_SYMBOL = keyof typeof TOKENS

/** Payment tokens the registrar accepts. Use this for pickers and pricing. */
export type SUPPORTED_TOKEN = keyof typeof SUPPORTED_TOKENS
export type SUPPORTED_TOKEN_ADDRESS =
  (typeof TOKENS)[SUPPORTED_TOKEN]['address']

export const EMPTY_ADDRESS = zeroAddress
export const REFERER_ADDRESS = zeroHash
