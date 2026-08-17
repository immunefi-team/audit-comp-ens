import { transactionManager } from '@ens-apps/transaction-manager'
import { useMutation } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import { useState } from 'react'
import type { Address, Hex, PublicClient } from 'viem'
import { useChainId } from 'wagmi'
import { useSmartAccountContext } from '@/lib/smart-account'
import { publicClient } from '@/lib/wagmi'
import {
  setPrimaryName,
  setPrimaryNameWithHca,
} from '../service/setPrimaryName'

export interface SetPrimaryNameArgs {
  name: string
  owner?: Address
}

export interface UseSetPrimaryNameOptions {
  /** Run once the primary-name update settles successfully. */
  onSuccess?: () => void
}

export interface UseSetPrimaryNameResult {
  /** Submit the primary-name update. Rejects on validation or transaction error. */
  submit: (args: SetPrimaryNameArgs) => Promise<void>
  isSubmitting: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | null
  /** Hash of the in-flight / latest transaction, tracked reactively. */
  txHash: Hex | undefined
  reset: () => void
}

/**
 * Drives the primary-name update through the transaction manager (replacing
 * primaryNameMachine). Exposes react-query mutation state for the UI and tracks
 * the current transaction hash via a selector on the tx actor. Success handling
 * (toast, cache invalidation, closing the dialog) belongs in `onSuccess`, not a
 * `useEffect` watching `isSuccess`.
 */
export function useSetPrimaryName(
  options?: UseSetPrimaryNameOptions,
): UseSetPrimaryNameResult {
  const account = useSmartAccountContext()
  const chainId = useChainId()
  const [txId, setTxId] = useState<string | undefined>()

  const txActor = txId ? transactionManager.getTransaction(txId) : undefined
  const txHash = useSelector(txActor, (snapshot) => snapshot?.context.hash)

  const mutation = useMutation({
    onSuccess: options?.onSuccess,
    mutationFn: async ({ name, owner }: SetPrimaryNameArgs) => {
      if (!owner) {
        throw new Error('Cannot set primary name - ENS owner is not available.')
      }

      const { signer, walletClient, ownerAddress } = account

      // HCA path: one owner-signed, user-paid intent via the reverse adapters.
      // The wallet client is required even here — it signs the intent and, when
      // the HCA cannot cover its own USDC fee, the funding permit as well.
      if (signer?.type === 'rhinestone' && ownerAddress && walletClient) {
        await setPrimaryNameWithHca({
          name,
          signer,
          ownerAddress: ownerAddress as Address,
          walletClient,
          publicClient: publicClient as PublicClient,
          chainId,
          onTxId: setTxId,
        })
        return
      }

      // EOA fallback: the owner wallet sends the two transactions directly.
      if (!walletClient || !ownerAddress) {
        throw new Error(
          'Cannot set primary name - account not ready. Please wait for wallet to connect.',
        )
      }

      await setPrimaryName({
        name,
        ownerAddress: ownerAddress as Address,
        walletClient,
        publicClient: publicClient as PublicClient,
        chainId,
        onTxId: setTxId,
      })
    },
  })

  return {
    submit: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    txHash,
    reset: () => {
      mutation.reset()
      setTxId(undefined)
    },
  }
}
