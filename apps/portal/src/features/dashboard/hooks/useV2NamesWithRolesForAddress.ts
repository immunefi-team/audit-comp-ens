import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

type RoleAssignment = {
  name: string | null
  roleBitmap: string
}

type DomainData = {
  name: string
  expiryDate: number | null
  subdomainCount: number
  recordCount: number
}

export type V2NameWithRoles = {
  name: string
  expiryDate: number | null
  roleBitmap: string
  subdomainCount: number
  recordCount: number
}

class GetV2NamesWithRolesForAddressError extends TaggedError(
  'GetV2NamesWithRolesForAddressError',
)<{
  cause: GetV2NamesWithRolesForAddressErrorType
}> {}

type GetV2NamesWithRolesForAddressErrorType = ClientError

type GetV2NamesWithRolesForAddressParameters = {
  address: Address
}

const getV2NamesWithRolesForAddress = ResultFn(async function* ({
  address,
}: GetV2NamesWithRolesForAddressParameters) {
  const { roles, domains } = yield* fromPromise(
    graphqlIndexerClient.request<{
      roles: RoleAssignment[]
      domains: DomainData[]
    }>(
      gql`
        query getNamesWithRolesForAddress($account: String!) {
          roles(account: $account) {
            name
            roleBitmap
          }
          domains(where: { owner: $account }) {
            name
            expiryDate
            subdomainCount
            recordCount
          }
        }
      `,
      { account: address.toLowerCase() },
    ),
    (e) =>
      new GetV2NamesWithRolesForAddressError({
        cause: e as GetV2NamesWithRolesForAddressErrorType,
      }),
  )

  // Build a map of domain name -> role bitmap (aggregate if multiple entries)
  const rolesMap = new Map<string, string>()
  for (const role of roles) {
    if (role.name) {
      const existing = rolesMap.get(role.name)
      if (!existing || BigInt(role.roleBitmap) > BigInt(existing)) {
        rolesMap.set(role.name, role.roleBitmap)
      }
    }
  }

  // Only include names the address owns, attaching role info where available
  const result: V2NameWithRoles[] = []
  for (const domain of domains) {
    result.push({
      name: domain.name,
      roleBitmap: rolesMap.get(domain.name) ?? '0',
      expiryDate: domain.expiryDate,
      subdomainCount: domain.subdomainCount,
      recordCount: domain.recordCount,
    })
  }

  return ok(result)
})

const getV2NamesWithRolesForAddressQueryKey = createQueryKey<
  'get-v2-names-with-roles-for-address',
  GetV2NamesWithRolesForAddressParameters
>('get-v2-names-with-roles-for-address')

export const getV2NamesWithRolesForAddressQueryOptions = (
  params: GetV2NamesWithRolesForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getV2NamesWithRolesForAddressQueryKey(params),
    queryFn: ({ queryKey: [, params] }) =>
      getV2NamesWithRolesForAddress(params),
  })
