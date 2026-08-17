import { useMemo } from 'react'
import { useSmartAccountContext } from '@/lib/smart-account'
import { type FeatureFlag, isFeatureEnabled } from '@/utils/feature-flags'

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { accountAddress } = useSmartAccountContext()

  return useMemo(
    () =>
      isFeatureEnabled(flag, {
        walletAddress: accountAddress,
      }),
    [flag, accountAddress],
  )
}
