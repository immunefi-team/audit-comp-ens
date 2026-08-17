/**
 * Hook for setting an L2 ENSv1 reverse name (`setName` on the L2 reverse
 * registrar).
 *
 * This path is deliberately separate from the L1 `useSetReverseResolution`
 * flow because L2 writes must go through the **local** `l2WagmiConfig`
 * (`@/lib/wagmiL2`) rather than the global Sepolia-bound wagmi config. The
 * global config is left completely untouched.
 *
 * Mechanism:
 *  - `useEnsureL2Connection()` (imperative `connect()` on `l2WagmiConfig`)
 *    silently re-attaches the user's already-connected EIP-1193 provider to
 *    the L2 config. For injected / MetaMask / Frame this is a no-op popup.
 *  - `useSwitchChain({ config: l2WagmiConfig })` requests the wallet switch
 *    to the target L2. If the chain isn't in the wallet, the wallet falls back
 *    to EIP-3085 `wallet_addEthereumChain` using the chain definition we've
 *    registered in `l2WagmiConfig`.
 *  - `useWriteContract({ config: l2WagmiConfig })` sends `setName(name)` to
 *    the L2 reverse registrar. We pass `chainId` per call so wagmi validates
 *    the wallet is on the right chain before signing.
 *  - `waitForTransactionReceipt(l2WagmiConfig, { chainId, hash })` waits for
 *    inclusion on the L2.
 */

import {
  getChainIdForReverseRegistrarChainId,
  getRegistrarAddress,
  l2ReverseRegistrarSetNameSnippet,
  type ReverseRegistrarChainId,
} from '@ens-apps/l2-primary/v1'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { waitForTransactionReceipt } from '@wagmi/core'
import type { Hex } from 'viem'
import { normalize } from 'viem/ens'
import { useSwitchChain, useWriteContract } from 'wagmi'
import { type L2ChainId, l2WagmiConfig } from '@/lib/wagmiL2'
import { useEnsureL2Connection } from './useEnsureL2Connection'

export interface SetL2ReverseNameParams {
  readonly name: string
  readonly reverseRegistrarChainId: Exclude<ReverseRegistrarChainId, 1 | 60>
}

export interface SetL2ReverseNameResult {
  readonly hash: Hex
  readonly chainId: L2ChainId
}

export function useSetL2ReverseName({
  onSuccess,
}: {
  onSuccess?: (result: SetL2ReverseNameResult) => void
} = {}) {
  const queryClient = useQueryClient()
  const ensureL2Connection = useEnsureL2Connection()

  // Bound to the L2 config — `switchChainAsync` will resolve once the wallet
  // is actually on the requested chain (or reject if the user declines).
  const { switchChainAsync } = useSwitchChain({ config: l2WagmiConfig })

  // `writeContractAsync` from a config-scoped `useWriteContract` returns a
  // promise resolving to the tx hash; `chainId` is type-narrowed to the
  // chains we put in `l2WagmiConfig`.
  const { writeContractAsync } = useWriteContract({ config: l2WagmiConfig })

  const mutation = useMutation({
    mutationFn: async ({
      name,
      reverseRegistrarChainId,
    }: SetL2ReverseNameParams): Promise<SetL2ReverseNameResult> => {
      const targetChainId = getChainIdForReverseRegistrarChainId(
        reverseRegistrarChainId,
        'sepolia',
      ) as L2ChainId

      const registrarAddress = getRegistrarAddress(
        reverseRegistrarChainId,
        'sepolia',
      )
      if (!registrarAddress) {
        throw new Error(
          `No L2 reverse registrar for chain ${reverseRegistrarChainId} (sepolia)`,
        )
      }

      // Normalize and validate before writing. The L2 reverse registrar's
      // `setName(string)` accepts any UTF-8 bytes verbatim, so unnormalized
      // / invalid input would persist as the reverse name and silently fail
      // every later forward-verify check.
      const normalizedName = normalize(name)

      await ensureL2Connection()
      await switchChainAsync({ chainId: targetChainId })

      const hash = await writeContractAsync({
        chainId: targetChainId,
        address: registrarAddress,
        abi: l2ReverseRegistrarSetNameSnippet,
        functionName: 'setName',
        args: [normalizedName],
      })

      await waitForTransactionReceipt(l2WagmiConfig, {
        chainId: targetChainId,
        hash,
      })

      return { hash, chainId: targetChainId }
    },
    onSuccess: (result) => {
      // Reverse-resolution table reads from ['get-reverse-resolution'];
      // the explorer-wide primary name (WalletMenu etc.) reads from
      // ['get-primary-name'], which goes through the batch reverse resolver
      // that ENSIP-19-aware resolution surfaces (including L2 records). Both
      // must be invalidated so the UI reflects the new L2 primary.
      queryClient.invalidateQueries({ queryKey: ['get-reverse-resolution'] })
      queryClient.invalidateQueries({ queryKey: ['get-primary-name'] })
      onSuccess?.(result)
    },
  })

  return {
    setL2ReverseName: mutation.mutate,
    setL2ReverseNameAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }
}
