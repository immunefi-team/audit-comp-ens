import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { checkRealNameAvailability } from '@/features/shared/service/nameChainContractService'
import { normalizeDomainNameFromUrl } from '@/utils/domain'

export const getRegistrationV2AvailabilityQueryOptions = (
  routeName: string,
) => {
  const normalizedName = normalizeDomainNameFromUrl(routeName)

  return resultQueryOptions({
    queryKey: $qk({
      $scope: 'register-v2',
      $action: 'checkAvailability',
      name: normalizedName,
    }),
    queryFn: () => checkRealNameAvailability(normalizedName),
    enabled: Boolean(normalizedName),
  })
}
