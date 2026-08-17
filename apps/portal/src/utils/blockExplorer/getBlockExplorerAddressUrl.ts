import type { Address, Chain } from 'viem'
import { getBlockExplorerBaseUrl } from './getBlockExplorerBaseUrl'

/**
 * Returns the block explorer URL for an address on the given chain.
 * Pure function: same inputs always produce the same output.
 *
 * @param chains - Array of chain configs (e.g. from wagmiConfig.chains)
 * @param chainId - The chain ID (e.g. 11155111 for Sepolia)
 * @param address - The address (e.g. 0x...)
 * @returns The full URL
 * @throws Error if the chain has no block explorer
 */
export function getBlockExplorerAddressUrl(
  chains: readonly Chain[],
  chainId: number,
  address: Address,
): string {
  const baseUrl = getBlockExplorerBaseUrl(chains, chainId)
  return `${baseUrl}/address/${address}`
}
