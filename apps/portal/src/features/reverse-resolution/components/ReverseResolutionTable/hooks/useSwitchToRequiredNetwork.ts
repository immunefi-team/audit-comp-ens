import {
  getChainIdForReverseRegistrarChainId,
  type NetworkKey,
  type ReverseRegistrarChainId,
} from '@ens-apps/l2-primary/v1'
import { useCallback } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { isL1ReverseRegistrarChainId } from '@/lib/reverseRegistrarChainId'
import { l2WagmiConfig } from '@/lib/wagmiL2'
import { useEnsureL2Connection } from '../../../hooks/useEnsureL2Connection'

type UseNetworkSwitchingParams = {
  reverseRegistrarChainId: ReverseRegistrarChainId
  /** Target deployment; defaults to 'sepolia' */
  network?: NetworkKey // 'mainnet' | 'sepolia'
}

/**
 * Determines whether the connected wallet is on the chain required to write
 * the reverse name for this row, and exposes a `switchChain` that switches
 * via the right wagmi config:
 *   - L1 targets (chainId 60/1)   → global wagmi config's `useSwitchChain`
 *   - L2 targets (Optimism/Arb/…) → `useSwitchChain({ config: l2WagmiConfig })`
 *
 * The L2 branch uses the local-only `l2WagmiConfig` so wagmi pulls chain
 * metadata (RPCs, explorers) for any EIP-3085 `wallet_addEthereumChain` call
 * from the L2 config rather than the global Sepolia-only config — keeping
 * the global config completely untouched.
 *
 * Important: wagmi's `switchChain` only prompts the wallet when the target
 * config has an active connection. For the L2 path we therefore have to
 * `useEnsureL2Connection()` first — without it, `switchChain` falls through
 * to a silent state-only update (no wallet popup, button appears dead).
 */
export function useSwitchToRequiredNetwork({
  reverseRegistrarChainId,
  network = 'sepolia',
}: UseNetworkSwitchingParams) {
  // Read `chainId` (connector-reported) rather than `chain` (config-resolved).
  // The global config only knows about Sepolia, so `chain` is `undefined`
  // whenever the wallet is on an L2.
  const { chainId: connectedChainId } = useAccount()

  const isL1Target = isL1ReverseRegistrarChainId(reverseRegistrarChainId)

  const l1Switch = useSwitchChain()
  const l2Switch = useSwitchChain({ config: l2WagmiConfig })

  const ensureL2Connection = useEnsureL2Connection()

  const requiredChainId = getChainIdForReverseRegistrarChainId(
    reverseRegistrarChainId,
    network,
  )
  const isWrongChain = connectedChainId !== requiredChainId
  const isSwitchingChain = isL1Target ? l1Switch.isPending : l2Switch.isPending

  const switchChainAsync = useCallback(
    async (variables: { chainId: number }) => {
      if (isL1Target) {
        // chainId narrowed to global config's chains
        await l1Switch.switchChainAsync(
          variables as Parameters<typeof l1Switch.switchChainAsync>[0],
        )
        return
      }
      // L2: re-attach the wallet to l2WagmiConfig first, otherwise wagmi
      // skips the wallet popup entirely. If the wallet doesn't have the
      // chain, viem will trigger EIP-3085 `wallet_addEthereumChain` using
      // the chain definition we registered in l2WagmiConfig.
      await ensureL2Connection()
      await l2Switch.switchChainAsync(
        variables as Parameters<typeof l2Switch.switchChainAsync>[0],
      )
    },
    [isL1Target, l1Switch, l2Switch, ensureL2Connection],
  )

  const getSwitchToRequiredNetworkRequest = () => ({
    chainId: requiredChainId,
  })

  return {
    isWrongChain,
    isSwitchingChain,
    requiredChainId,
    switchChainAsync,
    getSwitchToRequiredNetworkRequest,
  }
}
