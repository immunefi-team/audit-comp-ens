import { Domain_OrderBy, OrderDirection } from '@ens-apps/indexer'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import type { Address } from 'viem'
import { getDomains } from '@/features/dashboard/service/queries/getDashboardDomains'

export const PROFILE_NAMES_PAGE_SIZE = 5

export const profileOwnedNamesQuery = (
  address?: Address,
  { skip = 0 }: { skip?: number } = {},
) =>
  resultQueryOptions({
    queryKey: qk('profile', 'owned_names', { address, skip }),
    queryFn: address
      ? () =>
          getDomains({
            where: { owner: address.toLowerCase() },
            first: PROFILE_NAMES_PAGE_SIZE,
            skip,
            orderBy: Domain_OrderBy.RegistrationDate,
            orderDirection: OrderDirection.Desc,
          })
      : skipToken,
  })
