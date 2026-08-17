import { useQuery } from '@tanstack/react-query'
import { migratedNamesCountQueryOptions } from '@/features/migration/service/getMigratedNamesCount'
import { useSmartAccountContext } from '@/lib/smart-account'

type UseMigratedNamesCountOptions = {
  readonly enabled?: boolean
}

export const useMigratedNamesCount = (
  options: UseMigratedNamesCountOptions = {},
) => {
  const { enabled = true } = options
  const { ownerAddress } = useSmartAccountContext()
  return useQuery(
    migratedNamesCountQueryOptions(ownerAddress ?? undefined, enabled),
  )
}
