import type { Chain } from 'viem'

/**
 * Returns the base URL of the default block explorer for a chain.
 * Pure function: same inputs always produce the same output.
 *
 * @param chains - Array of chain configs (e.g. from wagmiConfig.chains)
 * @param chainId - The chain ID (e.g. 11155111 for Sepolia)
 * @returns The base URL without trailing slash
 * @throws Error if the chain has no block explorer
 */
export function getBlockExplorerBaseUrl(
  chains: readonly Chain[],
  chainId: number,
): string {
  const chain = chains.find((c) => c.id === chainId)
  const baseUrl = chain?.blockExplorers?.default?.url

  if (!baseUrl) {
    throw new Error(`Chain ${chainId} has no block explorer`)
  }

  return baseUrl.replace(/\/$/, '')
}
