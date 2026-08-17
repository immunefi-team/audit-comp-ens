/**
 * Utility for creating reverse resolution (address → name) contract calls
 *
 * Returns contract parameters for calling setName on the L2 Reverse Registrar.
 * The caller is responsible for executing the transaction and waiting for confirmation.
 *
 * This sets the reverse resolution for a specific coin type, which allows
 * an address to resolve to an ENS name on that chain/network.
 */

import type { Address, Chain } from 'viem'
import {
  l2ReverseRegistrarSetNameForAddrSnippet,
  l2ReverseRegistrarSetNameSnippet,
} from '../v1/L2ReverseRegistrar'
import {
  getRegistrarAddress,
  type ReverseRegistrarChainId,
  resolveNetworkFromChain,
} from '../v1/reverseRegistrarChainIds'

export type SetReverseNameRequest =
  | {
      address: Address
      abi: typeof l2ReverseRegistrarSetNameForAddrSnippet
      functionName: 'setNameForAddr'
      args: readonly [address: Address, name: string]
    }
  | {
      address: Address
      abi: typeof l2ReverseRegistrarSetNameSnippet
      functionName: 'setName'
      args: readonly [name: string]
    }

/**
 * Creates contract call parameters for setting reverse resolution
 * @param params.name - The ENS name to set
 * @param params.reverseRegistrarChainId - The chain ID for the reverse registrar
 * @param params.chain - Optional chain object to determine network (mainnet/testnet)
 * @param params.targetAddress - Optional address to set the name for. If not provided, sets for the caller
 * @returns Contract parameters to pass to writeContract
 * @throws Error if no registrar is found for the coin type
 */
export function createSetReverseNameRequest({
  name,
  reverseRegistrarChainId,
  chain,
  targetAddress,
}: {
  name: string
  reverseRegistrarChainId: ReverseRegistrarChainId
  chain?: Chain
  targetAddress?: Address
}): SetReverseNameRequest {
  const network = resolveNetworkFromChain(chain)
  const registrarAddress = getRegistrarAddress(reverseRegistrarChainId, network)

  if (!registrarAddress) {
    throw new Error(
      `No registrar found for coin type ${reverseRegistrarChainId} on ${network}`,
    )
  }

  if (targetAddress) {
    // Set name for a specific address
    return {
      address: registrarAddress,
      abi: l2ReverseRegistrarSetNameForAddrSnippet,
      functionName: 'setNameForAddr',
      args: [targetAddress, name] as const,
    }
  }

  // Set name for caller
  return {
    address: registrarAddress,
    abi: l2ReverseRegistrarSetNameSnippet,
    functionName: 'setName',
    args: [name] as const,
  }
}
