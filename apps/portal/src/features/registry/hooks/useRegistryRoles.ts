import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type { Role } from '@ensdomains/ensjs/utils/v2'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'
import { decodeRoleBitmap } from '@/lib/roles/decodeRoleBitmap'

class GetRegistryRolesError extends TaggedError('GetRegistryRolesError')<{
  cause: ClientError
}> {}

type GetRegistryRolesParameters = {
  address: Address
}

export type RegistryRoleRow = {
  /** Account holding registry-wide (root) roles. */
  account: Address
  /** Decoded role names held at the root resource (includes _ADMIN variants). */
  roles: Role[]
}

type IndexerRole = {
  account: string
  resource: string
  roleBitmap: string
}

const ROLES_LIMIT = 1000

// ROOT_RESOURCE (0x0) = registry-wide scope. A role here applies to the whole
// registry rather than a single name — i.e. the registry's admins/users.
const isRootResource = (resource: string) => BigInt(resource) === 0n

const getRegistryRoles = ResultFn(async function* ({
  address,
}: GetRegistryRolesParameters) {
  const { registry } = yield* fromPromise(
    graphqlIndexerClient.request<{
      registry: { roleConnection: { edges: { node: IndexerRole }[] } } | null
    }>(
      gql`
        query getRegistryRoles($address: String!) {
          registry(address: $address) {
            roleConnection(first: ${ROLES_LIMIT}) {
              edges {
                node {
                  account
                  resource
                  roleBitmap
                }
              }
            }
          }
        }
      `,
      { address: address.toLowerCase() },
    ),
    (e) => new GetRegistryRolesError({ cause: e as ClientError }),
  )

  // null = indexer has no record for this address (not a registry, or not yet
  // indexed). An empty list is the right shape here.
  if (!registry) return ok([])

  // One bitmap per (resource, account); OR defensively against duplicates.
  const bitmapByAccount = new Map<string, bigint>()
  for (const { node } of registry.roleConnection.edges) {
    if (!isRootResource(node.resource)) continue
    const key = node.account.toLowerCase()
    bitmapByAccount.set(
      key,
      (bitmapByAccount.get(key) ?? 0n) | BigInt(node.roleBitmap),
    )
  }

  const rows: RegistryRoleRow[] = Array.from(
    bitmapByAccount,
    ([account, bitmap]) => ({
      account: account as Address,
      roles: decodeRoleBitmap(bitmap),
    }),
  ).filter((row) => row.roles.length > 0)

  return ok(rows)
})

const getRegistryRolesQueryKey = createQueryKey<
  'get-registry-roles',
  GetRegistryRolesParameters
>('get-registry-roles')

export const getRegistryRolesQueryOptions = (
  params: GetRegistryRolesParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryRolesQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryRoles(params),
  })
