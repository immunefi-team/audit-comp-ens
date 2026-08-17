import {
  type Domain_OrderBy,
  type DomainFilter,
  type DomainFragment,
  DomainsDocument,
  type DomainsQuery,
  type DomainsQueryVariables,
  type OrderDirection,
} from '@ens-apps/indexer'
import indexerClient from '@ens-apps/indexer/urql'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { GetDomainsError } from './getDashboardDomains'

const PAGE_SIZE = 200

type DashboardDomainsQueryVariables = {
  readonly where: DomainFilter
  readonly orderBy: Domain_OrderBy
  readonly orderDirection: OrderDirection
}

type DashboardDomainsPage = {
  readonly domains: DomainFragment[]
  readonly nextSkip: number | undefined
}

const fetchDomainsPage = async ({
  where,
  orderBy,
  orderDirection,
  skip,
}: DashboardDomainsQueryVariables & {
  readonly skip: number
}): Promise<DashboardDomainsPage> => {
  try {
    const result = await indexerClient
      .query<DomainsQuery, DomainsQueryVariables>(DomainsDocument, {
        where,
        first: PAGE_SIZE,
        skip,
        orderBy,
        orderDirection,
      })
      .toPromise()

    if (result.error) throw result.error
    if (!result.data) throw new Error('Indexer query returned no data')

    const domains = result.data.domains
    return {
      domains,
      nextSkip: domains.length < PAGE_SIZE ? undefined : skip + PAGE_SIZE,
    }
  } catch (error) {
    throw new GetDomainsError({ cause: error })
  }
}

export const getAllDomainsInfiniteQuery = (
  variables: DashboardDomainsQueryVariables | undefined,
) =>
  infiniteQueryOptions({
    queryKey: qk('dashboard', 'all_domains', variables ?? {}),
    enabled: variables !== undefined,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if (!variables)
        return Promise.resolve({ domains: [], nextSkip: undefined })
      return fetchDomainsPage({
        ...variables,
        skip: pageParam as number,
      })
    },
    getNextPageParam: (lastPage) => lastPage.nextSkip,
    select: (data) => data.pages.flatMap((page) => page.domains),
  })
