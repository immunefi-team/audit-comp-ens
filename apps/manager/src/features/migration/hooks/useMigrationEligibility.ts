import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { useQuery } from '@tanstack/react-query'
import type { Address, PublicClient } from 'viem'
import type { ClassifiedName } from '@/features/migration/service/classifyNames'
import { runEligibilityChecks } from '@/features/migration/service/preflightChecks'
import { publicClient } from '@/lib/wagmi'

const ELIGIBILITY_STALE_MS = 30 * 60 * 1000

export const useMigrationEligibility = (
  names: readonly ClassifiedName[],
  ownerAddress?: string | null,
) => {
  const domainIds = names.map((n) => n.domain.id)
  return useQuery({
    queryKey: qk('migration', 'eligibility', {
      owner: ownerAddress?.toLowerCase(),
      domainIds,
    }),
    queryFn: () =>
      runEligibilityChecks(
        publicClient as PublicClient,
        [...names],
        ownerAddress as Address,
      ),
    enabled: !!ownerAddress && names.length > 0,
    staleTime: ELIGIBILITY_STALE_MS,
  })
}
