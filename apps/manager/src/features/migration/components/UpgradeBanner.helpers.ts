import type { ClassifiedName } from '@/features/migration/service/classifyNames'

type ShouldShowUpgradeBannerParams = {
  readonly eligibleV1Names: readonly ClassifiedName[]
  readonly migratedCount: number | null | undefined
  readonly profileName?: string
}

const normalizeName = (name: string) => name.trim().toLowerCase()

const isEligibleProfileName = (
  eligibleV1Names: readonly ClassifiedName[],
  profileName: string,
) => {
  const normalizedProfileName = normalizeName(profileName)
  return eligibleV1Names.some(
    ({ domain }) => normalizeName(domain.name) === normalizedProfileName,
  )
}

export const shouldShowUpgradeBanner = ({
  eligibleV1Names,
  migratedCount,
  profileName,
}: ShouldShowUpgradeBannerParams): boolean => {
  if (!eligibleV1Names.length) return false
  if (profileName !== undefined) {
    return isEligibleProfileName(eligibleV1Names, profileName)
  }
  if ((migratedCount ?? 0) >= 1) return false
  return true
}
