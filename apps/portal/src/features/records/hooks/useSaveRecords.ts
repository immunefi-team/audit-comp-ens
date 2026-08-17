/**
 * React hook wrapper for saveRecords.
 *
 * Provides a mutation with loading/error states for the UI.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { profileQueryKey } from '@/features/profile/hooks/useProfile'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { type SaveRecordsParameters, saveRecords } from '../helpers/saveRecords'

type UseSaveRecordsParameters = Omit<
  SaveRecordsParameters,
  'walletClient' | 'publicClient' | 'signer' | 'chainId'
>

type UseSaveRecordsOptions = {
  /** Called after syncing completes (indexer has caught up) */
  onSyncComplete?: () => void
}

/**
 * Hook that provides a mutation for saving ENS records.
 *
 * Uses TanStack Query's useMutation for proper loading/error states.
 * Automatically invalidates and refetches the profile query on success,
 * with polling to handle indexer lag.
 */
export function useSaveRecords(options: UseSaveRecordsOptions = {}) {
  const { onSyncComplete } = options
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { chain, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const [isSyncing, setIsSyncing] = useState(false)
  const isWrongChain = isConnected && chain?.id !== chainId

  const getSwitchToRequiredNetworkRequest = useCallback(() => ({ chainId }), [])

  const switchToRequiredNetwork = useCallback(() => {
    switchChain(getSwitchToRequiredNetworkRequest())
  }, [getSwitchToRequiredNetworkRequest, switchChain])

  const syncAfterSave = useCallback(
    async (name: string) => {
      setIsSyncing(true)

      try {
        await pollForIndexerSync({
          invalidateQueries: () =>
            // Name-only key so this matches the active profile query
            // regardless of its `protocolVersion` — a `{ name, protocolVersion:
            // undefined }` key does NOT partial-match `{ name, protocolVersion:
            // 'ENSv2' }`, so the profile never refetched.
            queryClient.invalidateQueries({
              queryKey: profileQueryKey({ name }),
              refetchType: 'all',
            }),
        })
      } finally {
        setIsSyncing(false)
        onSyncComplete?.()
      }
    },
    [queryClient, onSyncComplete],
  )

  const mutation = useMutation({
    mutationFn: async (params: UseSaveRecordsParameters) => {
      if (!isConnected) {
        throw new Error('No account connected')
      }

      if (!walletClient || !publicClient) {
        if (isWrongChain) {
          throw new Error('Wrong network. Switch to Sepolia to save records.')
        }

        throw new Error('Wallet not connected')
      }

      if (!walletClient.account) {
        throw new Error('No account connected')
      }

      const signer = createEOASigner(walletClient)

      return saveRecords({
        ...params,
        walletClient,
        publicClient,
        signer,
        chainId,
      })
    },
    onSuccess: (_data, variables) => {
      // Start refetching with retry logic (don't await - let it run in background)
      syncAfterSave(variables.name)
    },
  })

  return {
    saveRecords: mutation.mutate,
    isWriting: mutation.isPending,
    isConfirming: mutation.isPending,
    isSyncing,
    isSuccess: mutation.isSuccess && !isSyncing,
    isError: mutation.isError,
    error: mutation.error,
    txHash: mutation.data?.hash,
    reset: mutation.reset,
    hasWallet: !!walletClient,
    isWrongChain,
    isSwitchingChain,
    switchToRequiredNetwork,
    requiredChainId: chainId,
  }
}
