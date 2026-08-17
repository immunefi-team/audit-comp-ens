import type { Address, Hash } from 'viem'
import { useChainId, useConfig } from 'wagmi'
import { getBlockExplorerAddressUrl } from './getBlockExplorerAddressUrl'
import { getBlockExplorerTxUrl } from './getBlockExplorerTxUrl'

/**
 * Returns the block explorer transaction URL for the given tx hash.
 * Uses the provided chainId if given, otherwise the connected chain from wagmi.
 *
 * @param txHash - The transaction hash
 * @param chainId - Optional chain ID (e.g. from row.original.network?.chainId). Falls back to useChainId() when omitted.
 * @returns The full URL, or undefined if the chain has no block explorer
 */
export function useBlockExplorerTxUrl(
  txHash: Hash | undefined,
  chainId?: number,
): string | undefined {
  const connectedChainId = useChainId()
  const config = useConfig()
  const chains = config.chains
  const effectiveChainId = chainId ?? connectedChainId

  if (!txHash) return undefined

  return getBlockExplorerTxUrl(chains, effectiveChainId, txHash)
}

/**
 * Returns the block explorer address URL for the given address.
 * Uses the provided chainId if given, otherwise the connected chain from wagmi.
 *
 * @param address - The address (e.g. 0x...)
 * @param chainId - Optional chain ID. Falls back to useChainId() when omitted.
 * @returns The full URL, or undefined if the chain has no block explorer
 */
export function useBlockExplorerAddressUrl(
  address: Address | undefined,
  chainId?: number,
): string | undefined {
  const connectedChainId = useChainId()
  const config = useConfig()
  const chains = config.chains
  const effectiveChainId = chainId ?? connectedChainId

  if (!address) return undefined

  return getBlockExplorerAddressUrl(chains, effectiveChainId, address)
}
