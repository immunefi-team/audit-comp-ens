import { useMemo } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { useMigrationEligibility } from '@/features/migration/hooks/useMigrationEligibility'
import { useV1Names } from '@/features/migration/hooks/useV1Names'
import { classifyNames } from '@/features/migration/service/classifyNames'
import { useSmartAccountContext } from '@/lib/smart-account'
import type { DashboardV1Name } from './mergedNames'
import { getV1NameRoles } from './v1NameRoles'

type UseDashboardV1NamesOptions = {
  readonly migrationEnabled?: boolean
}

export const useDashboardV1Names = (
  options: UseDashboardV1NamesOptions = {},
) => {
  const { migrationEnabled = false } = options
  const { ownerAddress } = useSmartAccountContext()
  const { address } = useConnection()
  const resolvedOwnerAddress = ownerAddress ?? address
  const { data: v1NamesRaw, isPending, isError } = useV1Names()

  const classified = useMemo(() => {
    if (!migrationEnabled || !v1NamesRaw || !resolvedOwnerAddress) return []
    return classifyNames(v1NamesRaw, resolvedOwnerAddress as Address).classified
  }, [migrationEnabled, v1NamesRaw, resolvedOwnerAddress])

  const { data: eligibility, isPending: isEligibilityPending } =
    useMigrationEligibility(
      classified,
      migrationEnabled ? resolvedOwnerAddress : undefined,
    )

  const eligibleIds = useMemo(() => {
    if (!migrationEnabled) return new Set<string>()
    return new Set(
      (eligibility?.eligible ?? classified).map((name) => name.domain.id),
    )
  }, [classified, eligibility?.eligible, migrationEnabled])

  const v1Names = useMemo<DashboardV1Name[]>(
    () =>
      (v1NamesRaw ?? []).map((domain) => ({
        domain,
        label: domain.labelName ?? domain.name,
        isMigrationEligible: eligibleIds.has(domain.id),
        nameRoles: getV1NameRoles(domain, resolvedOwnerAddress),
      })),
    [eligibleIds, resolvedOwnerAddress, v1NamesRaw],
  )

  return {
    v1Names,
    isPending:
      isPending ||
      (migrationEnabled && classified.length > 0 && isEligibilityPending),
    isError,
  }
}
