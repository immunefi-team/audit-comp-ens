import type { DomainFragment } from '@ens-apps/indexer'
import { Domain_OrderBy, OrderDirection } from '@ens-apps/indexer'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { getDomains } from '@/features/dashboard/service/queries/getDashboardDomains'
import { getDashboardRoleAssignments } from '@/features/dashboard/service/queries/getDashboardRoleAssignments'
import { getManagedOnlyRoleNames } from '@/features/dashboard/v2NameRoles'
import { getV1NamesForAddress } from '@/features/migration/service/v1SubgraphClient'
import {
  buildProfileAddressNames,
  type ProfileAddressName,
} from './buildProfileAddressNames'

export { PROFILE_NAMES_PAGE_SIZE } from './profileOwnedNames'

const V2_NAMES_PAGE_SIZE = 50
const MANAGED_NAMES_CHUNK_SIZE = 50

class GetProfileAddressNamesError extends TaggedError(
  'GetProfileAddressNamesError',
)<{
  cause: unknown
}> {}

const fetchAllV2DomainsForAddress = ResultFn(async function* (
  normalizedAddress: string,
) {
  const domains: DomainFragment[] = []
  let skip = 0

  while (true) {
    const page = yield* getDomains({
      where: { owner: normalizedAddress },
      first: V2_NAMES_PAGE_SIZE,
      skip,
      orderBy: Domain_OrderBy.RegistrationDate,
      orderDirection: OrderDirection.Desc,
    })

    domains.push(...page.domains)
    if (page.domains.length < V2_NAMES_PAGE_SIZE) break
    skip += V2_NAMES_PAGE_SIZE
  }

  return ok(domains)
})

const fetchDomainsByNames = ResultFn(async function* (
  names: readonly string[],
) {
  if (names.length === 0) return ok([] as DomainFragment[])

  const domains: DomainFragment[] = []
  for (let i = 0; i < names.length; i += MANAGED_NAMES_CHUNK_SIZE) {
    const chunk = names.slice(i, i + MANAGED_NAMES_CHUNK_SIZE)
    const page = yield* getDomains({
      where: { name_in: [...chunk] },
      first: chunk.length,
    })
    domains.push(...page.domains)
  }

  return ok(domains)
})

export const getProfileAddressNames = ResultFn(async function* (
  address: Address,
) {
  const normalizedAddress = address.toLowerCase()

  const v1Domains = yield* getV1NamesForAddress(normalizedAddress)
  const v2Domains = yield* fetchAllV2DomainsForAddress(normalizedAddress)
  const roleAssignments = yield* fromPromise(
    getDashboardRoleAssignments(normalizedAddress),
    (error) => new GetProfileAddressNamesError({ cause: error }),
  )

  const managedOnlyNames = getManagedOnlyRoleNames(v2Domains, roleAssignments)
  const managedV2Domains = yield* fetchDomainsByNames(managedOnlyNames)

  const names = buildProfileAddressNames({
    address: normalizedAddress,
    v1Domains,
    v2Domains,
    managedV2Domains,
    roleAssignments,
  })

  return ok(names)
})

export const profileAddressNamesQuery = (address?: Address) =>
  resultQueryOptions({
    queryKey: qk('profile', 'address_names', {
      address: address?.toLowerCase(),
    }),
    queryFn: address ? () => getProfileAddressNames(address) : skipToken,
    meta: {
      dependsOn: ['indexer'],
    },
  })

export type { ProfileAddressName }
