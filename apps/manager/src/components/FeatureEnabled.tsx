import type { ReactNode } from 'react'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import type { FeatureFlag } from '@/utils/feature-flags'

interface FeatureEnabledProps {
  flag: FeatureFlag
  children: ReactNode
  fallback?: ReactNode
}

export const FeatureEnabled = ({
  flag,
  children,
  fallback = null,
}: FeatureEnabledProps) => {
  const isEnabled = useFeatureFlag(flag)

  if (!isEnabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
