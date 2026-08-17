import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import type { Address } from 'viem'
import { sepoliaWithEns } from '@/lib/wagmi'

// The renewer contracts, resolved from the ensjs chain config — no hardcoded
// addresses. `ETHRenewerV1` is the ENSv2-native renewer for legacy (ENSv1) names
// that have NOT yet migrated (legacy `ETHRegistrarController`s were revoked at
// the v2 cutover). Both expose the same `IETHRenewer` ERC-20 interface.
const ethRegistrar = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensEthRegistrar',
})

const ethRenewerV1 = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensEthRenewerV1',
})

/**
 * The renewer contract to call for a name: the v2 `ETHRegistrar` for migrated /
 * v2-native names, or `ETHRenewerV1` for unmigrated v1 names. Both expose the
 * same `getRenewPrice` / `renew(label,duration,token,referrer)` ERC-20 interface
 * and are the ERC-20 spender for the approval step.
 */
export const getRenewerAddress = (isV2: boolean): Address =>
  isV2 ? ethRegistrar : ethRenewerV1
