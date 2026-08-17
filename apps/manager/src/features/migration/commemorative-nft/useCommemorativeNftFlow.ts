import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useConfig } from 'wagmi'
import type {
  CommemorativeNftCardData,
  MigrationSuccessDialogState,
} from '../components/success/MigrationSuccessDialog.types'
import { buildCommemorativeNftCardData } from './cardData'
import {
  claimCommemorativeNft,
  decodeCommemorativeNftClaimError,
  waitForCommemorativeNftClaimReceipt,
} from './contract'
import { createCommemorativeNftPreviewEligibility } from './eligibility.fixture'
import {
  type CommemorativeNftFlowStatus,
  getCommemorativeNftClaimedStatus,
  getCommemorativeNftFlowStatus,
  isCommemorativeNftClaimResultFresh,
} from './flowState'
import { invalidateCommemorativeNftStatus } from './queries'
import type { CommemorativeNftEligibility } from './types'
import { useCommemorativeNftAvailability } from './useCommemorativeNftAvailability'

type UseCommemorativeNftFlowOptions = {
  readonly open: boolean
  readonly ownerAddress: Address | undefined
  readonly walletAddress: Address | undefined
  readonly migratedNameCount: number
  readonly preview?: boolean
  readonly previewProfileName?: string
}

type ClaimReadBoundary = {
  readonly key: string | undefined
  readonly dataUpdatedAt: number
}

const getClaimErrorMessage = (error: unknown): string =>
  decodeCommemorativeNftClaimError(error).message

const getEffectiveEligibility = (params: {
  readonly remoteEligibility?: CommemorativeNftEligibility
  readonly preview: boolean
  readonly ownerAddress?: Address
  readonly previewProfileName?: string
}): CommemorativeNftEligibility | undefined => {
  if (params.remoteEligibility) return params.remoteEligibility
  if (!params.preview) return undefined
  return createCommemorativeNftPreviewEligibility({
    ownerAddress: params.ownerAddress,
    profileName: params.previewProfileName,
  })
}

const getEligibilityFlowStatus = (params: {
  readonly isError: boolean
  readonly isPending: boolean
  readonly hasEligibility: boolean
  readonly dataStatus?: 'eligible' | 'ineligible' | 'unavailable'
}): 'pending' | 'error' | 'eligible' | 'ineligible' | 'unavailable' => {
  if (params.isError) return 'error'
  if (params.isPending && !params.hasEligibility) return 'pending'
  if (params.hasEligibility) return 'eligible'
  return params.dataStatus ?? 'pending'
}

const getNonArtworkDialogState = (params: {
  readonly flowStatus: CommemorativeNftFlowStatus
  readonly eligibilityError?: Error | null
  readonly claimError?: Error | null
  readonly card?: CommemorativeNftCardData
}): MigrationSuccessDialogState | undefined => {
  switch (params.flowStatus) {
    case 'loadingEligibility':
      return { status: 'loadingEligibility' }
    case 'ineligible':
      return { status: 'ineligible' }
    case 'eligibilityError':
      return {
        status: 'error',
        stage: 'eligibility',
        message:
          params.eligibilityError?.message ||
          'Eligibility could not be loaded. Please try again.',
      }
    case 'configurationError':
      return {
        status: 'error',
        stage: 'configuration',
        message: 'The commemorative NFT preview is not available yet.',
      }
    case 'claimError':
      return {
        status: 'error',
        stage: 'claim',
        message:
          params.claimError?.message || getClaimErrorMessage(params.claimError),
        card: params.card,
      }
    default:
      return undefined
  }
}

const getArtworkDialogState = (params: {
  readonly flowStatus: CommemorativeNftFlowStatus
  readonly card?: CommemorativeNftCardData
  readonly txHash?: Hex
}): MigrationSuccessDialogState => {
  if (!params.card) return { status: 'loadingEligibility' }

  switch (params.flowStatus) {
    case 'readyToMint':
      return { status: 'readyToMint', card: params.card }
    case 'minting':
      return { status: 'minting', card: params.card, txHash: params.txHash }
    case 'minted':
      return { status: 'minted', card: params.card }
    default:
      return { status: 'revealing', card: params.card }
  }
}

export const useCommemorativeNftFlow = ({
  open,
  ownerAddress,
  walletAddress,
  migratedNameCount,
  preview = false,
  previewProfileName,
}: UseCommemorativeNftFlowOptions) => {
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [revealComplete, setRevealComplete] = useState(false)
  const [txHash, setTxHash] = useState<Hex | undefined>()
  const [awaitingClaim, setAwaitingClaim] = useState(false)
  const [migratedAt, setMigratedAt] = useState(() => new Date())

  const availability = useCommemorativeNftAvailability({
    ownerAddress,
    enabled: open,
    pollClaimed: awaitingClaim,
    allowDevFixture: true,
  })
  const claimReadKey = ownerAddress
    ? `${availability.chainId}:${ownerAddress.toLowerCase()}`
    : undefined
  const claimedDataUpdatedAt = availability.claimed.dataUpdatedAt
  const [claimReadBoundary, setClaimReadBoundary] = useState<ClaimReadBoundary>(
    () => ({
      key: claimReadKey,
      dataUpdatedAt: claimedDataUpdatedAt,
    }),
  )

  useEffect(() => {
    if (open && claimReadBoundary.key === claimReadKey) return
    setClaimReadBoundary({
      key: claimReadKey,
      dataUpdatedAt: claimedDataUpdatedAt,
    })
  }, [claimReadBoundary.key, claimedDataUpdatedAt, claimReadKey, open])

  const remoteEligibility =
    availability.eligibility.data?.status === 'eligible'
      ? availability.eligibility.data.eligibility
      : undefined
  const eligibility = useMemo<CommemorativeNftEligibility | undefined>(() => {
    return getEffectiveEligibility({
      remoteEligibility,
      preview,
      ownerAddress,
      previewProfileName,
    })
  }, [ownerAddress, preview, previewProfileName, remoteEligibility])

  const eligibilityKey = eligibility
    ? `${eligibility.ownerAddress}:${eligibility.rendererName}`
    : undefined

  useEffect(() => {
    if (!open) return
    setMigratedAt(new Date())
    setRevealComplete(Boolean(shouldReduceMotion))
    setTxHash(undefined)
    setAwaitingClaim(false)
  }, [open, shouldReduceMotion])

  useEffect(() => {
    setRevealComplete(eligibilityKey ? Boolean(shouldReduceMotion) : false)
  }, [eligibilityKey, shouldReduceMotion])

  useEffect(() => {
    if (availability.claimed.data === true) setAwaitingClaim(false)
  }, [availability.claimed.data])

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!eligibility || !ownerAddress || !walletAddress) {
        throw new Error('The eligible owner wallet is not connected.')
      }
      if (eligibility.source === 'preview' || eligibility.proof.length === 0) {
        throw new Error('This preview is display-only.')
      }

      const hash = await claimCommemorativeNft({
        wagmiConfig,
        chainId: availability.chainId,
        ownerAddress,
        walletAddress,
        proof: eligibility.proof,
      })
      setTxHash(hash)
      setAwaitingClaim(true)
      await waitForCommemorativeNftClaimReceipt({
        wagmiConfig,
        chainId: availability.chainId,
        hash,
      })
      return hash
    },
    onSuccess: async (hash) => {
      setTxHash(hash)
      setAwaitingClaim(true)
      if (!ownerAddress) return
      await invalidateCommemorativeNftStatus({
        queryClient,
        ownerAddress,
        chainId: availability.chainId,
      })
    },
    onError: async (error) => {
      const decoded = decodeCommemorativeNftClaimError(error)
      if (decoded.reason !== 'already-claimed' || !ownerAddress) {
        setAwaitingClaim(false)
        return
      }
      setAwaitingClaim(true)
      await invalidateCommemorativeNftStatus({
        queryClient,
        ownerAddress,
        chainId: availability.chainId,
      })
    },
  })

  const hasFreshClaimedResult = isCommemorativeNftClaimResultFresh({
    claimReadKey,
    requiredClaimReadKey: claimReadBoundary.key,
    dataUpdatedAt: claimedDataUpdatedAt,
    requiredDataUpdatedAt: claimReadBoundary.dataUpdatedAt,
    isSuccess: availability.claimed.isSuccess,
    fetchStatus: availability.claimed.fetchStatus,
  })
  const claimedStatus = getCommemorativeNftClaimedStatus({
    preview,
    claimed: availability.claimed.data,
    isFresh: hasFreshClaimedResult,
  })
  const claimed = claimedStatus === true
  const artworkUrl = eligibility?.assets.imageUrl

  useEffect(() => {
    if (open && eligibilityKey && !artworkUrl) setRevealComplete(true)
  }, [artworkUrl, eligibilityKey, open])

  const card = useMemo<CommemorativeNftCardData | undefined>(() => {
    if (!eligibility) return undefined

    return buildCommemorativeNftCardData({
      artworkUrl,
      chainId: availability.chainId,
      eligibility,
      migratedAt,
      migratedNameCount,
      minted: claimed,
      ownerAddress: eligibility.ownerAddress,
    })
  }, [
    availability.chainId,
    artworkUrl,
    claimed,
    eligibility,
    migratedAt,
    migratedNameCount,
  ])

  const eligibilityStatus = availability.supported
    ? getEligibilityFlowStatus({
        isError: availability.eligibility.isError,
        isPending: availability.eligibility.isPending,
        hasEligibility: !!eligibility,
        dataStatus: availability.eligibility.data?.status,
      })
    : 'unavailable'

  const flowStatus = getCommemorativeNftFlowStatus({
    eligibilityStatus,
    claimed: claimedStatus,
    revealComplete,
    claimPending: claimMutation.isPending || awaitingClaim,
    claimError: claimMutation.isError || availability.claimed.isError,
  })

  const state =
    getNonArtworkDialogState({
      flowStatus,
      eligibilityError: availability.eligibility.error,
      claimError:
        availability.claimed.error ||
        (claimMutation.error instanceof Error ? claimMutation.error : null),
      card,
    }) ?? getArtworkDialogState({ flowStatus, card, txHash })

  const retry = useCallback(async () => {
    claimMutation.reset()
    setTxHash(undefined)
    setAwaitingClaim(false)
    await Promise.all([
      availability.eligibility.refetch(),
      availability.claimed.refetch(),
    ])
  }, [availability.claimed, availability.eligibility, claimMutation])
  const completeReveal = useCallback(() => setRevealComplete(true), [])

  return {
    state,
    eligibility,
    canMint:
      !!eligibility &&
      eligibility.source !== 'preview' &&
      eligibility.proof.length > 0 &&
      !!walletAddress &&
      !!ownerAddress,
    completeReveal,
    mint: claimMutation.mutateAsync,
    retry,
  }
}
