import type { Chain, Hash } from 'viem'
import { getBlockExplorerBaseUrl } from './getBlockExplorerBaseUrl'

/**
 * Returns the block explorer URL for a transaction on the given chain.
 * Pure function: same inputs always produce the same output.
 *
 * @param chains - Array of chain configs (e.g. from wagmiConfig.chains)
 * @param chainId - The chain ID (e.g. 11155111 for Sepolia)
 * @param txHash - The transaction hash
 * @returns The full URL
 * @throws Error if the chain has no block explorer
 */
export function getBlockExplorerTxUrl(
  chains: readonly Chain[],
  chainId: number,
  txHash: Hash,
): string {
  const baseUrl = getBlockExplorerBaseUrl(chains, chainId)
  return `${baseUrl}/tx/${txHash}`
}
