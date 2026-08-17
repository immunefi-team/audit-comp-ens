import { useMemo } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { useMigrationEligibility } from '@/features/migration/hooks/useMigrationEligibility'
import { useV1Names } from '@/features/migration/hooks/useV1Names'
import {
  type ClassifiedName,
  classifyNames,
} from '@/features/migration/service/classifyNames'
import { useSmartAccountContext } from '@/lib/smart-account'

type UseEligibleV1NamesOptions = {
  readonly enabled?: boolean
  readonly fallbackToClassified?: boolean
}

export const useEligibleV1Names = (options: UseEligibleV1NamesOptions = {}) => {
  const { enabled = true, fallbackToClassified = true } = options
  const { ownerAddress } = useSmartAccountContext()
  const { address } = useConnection()
  const resolvedOwnerAddress = ownerAddress ?? address
  const { data: v1NamesRaw, isPending: isV1Pending } = useV1Names({ enabled })

  const classified = useMemo<ClassifiedName[]>(() => {
    if (!enabled || !v1NamesRaw || !resolvedOwnerAddress) return []
    return classifyNames(v1NamesRaw, resolvedOwnerAddress as Address).classified
  }, [enabled, v1NamesRaw, resolvedOwnerAddress])

  const { data: eligibility, isPending: isEligibilityPending } =
    useMigrationEligibility(
      classified,
      enabled ? resolvedOwnerAddress : undefined,
    )

  const eligible = useMemo<readonly ClassifiedName[]>(
    () => eligibility?.eligible ?? (fallbackToClassified ? classified : []),
    [eligibility, classified, fallbackToClassified],
  )

  return {
    eligible,
    isPending:
      enabled &&
      (isV1Pending || (classified.length > 0 && isEligibilityPending)),
  }
}
