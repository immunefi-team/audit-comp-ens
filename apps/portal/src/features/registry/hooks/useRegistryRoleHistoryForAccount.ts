/**
 * Role-change history for a single account at the **registry root** resource.
 *
 * Queries `EACRolesChanged` events for the given registry contract from the
 * indexer, then narrows them client-side to events scoped to `ROOT_RESOURCE`
 * for the supplied account. Mirrors the query strategy used by
 * `useNameRoleAccounts` (which is per-name) and `useRoleHistory` (which is
 * global) but scoped to the registry overview's add/edit-user UI.
 */

import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'
import {
  filterEventsByResource,
  type IndexerEACEvent,
  type RoleHistoryEntry,
} from '@/lib/roles/filterEventsByResource'

class GetRegistryRoleHistoryError extends TaggedError(
  'GetRegistryRoleHistoryError',
)<{
  cause: ClientError
}> {}

export type GetRegistryRoleHistoryParameters = {
  readonly registryAddress: Address
  readonly account: Address
}

// 32-byte zero — registry-wide ROOT_RESOURCE (see useRegistryRoles.ts).
const ROOT_RESOURCE_HEX = `0x${'0'.repeat(64)}`

// Single capped fetch (no pagination — a proper paginated component is tracked
// separately). The newest `EVENTS_LIMIT` role-change events comfortably cover a
// single account's root-role history in practice.
const EVENTS_LIMIT = 1000

const getRegistryRoleHistoryForAccount = ResultFn(async function* ({
  registryAddress,
  account,
}: GetRegistryRoleHistoryParameters) {
  const { events } = yield* fromPromise(
    graphqlIndexerClient.request<{ events: IndexerEACEvent[] }>(
      gql`
        query getRegistryRoleHistoryForAccount(
          $contractAddress: String!
          $first: Int!
        ) {
          events(
            where: {
              type: "EACRolesChanged"
              contractAddress: $contractAddress
            }
            first: $first
            orderBy: blockNumber
            orderDirection: desc
          ) {
            type
            data
            transactionHash
            timestamp
            blockNumber
          }
        }
      `,
      {
        contractAddress: registryAddress.toLowerCase(),
        first: EVENTS_LIMIT,
      },
    ),
    (e) => new GetRegistryRoleHistoryError({ cause: e as ClientError }),
  )

  const rootEntries = filterEventsByResource(events, ROOT_RESOURCE_HEX)
  const target = account.toLowerCase()
  const accountEntries: RoleHistoryEntry[] = rootEntries.filter(
    (entry) => entry.account.toLowerCase() === target,
  )

  return ok(accountEntries)
})

const getRegistryRoleHistoryForAccountQueryKey = createQueryKey<
  'get-registry-role-history-for-account',
  GetRegistryRoleHistoryParameters
>('get-registry-role-history-for-account')

export const getRegistryRoleHistoryForAccountQueryOptions = (
  params: GetRegistryRoleHistoryParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryRoleHistoryForAccountQueryKey(params),
    queryFn: ({ queryKey: [, params] }) =>
      getRegistryRoleHistoryForAccount(params),
  })
