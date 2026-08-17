import type { EacRoleAssignment } from '@ens-apps/indexer'
import indexerClient from '@ens-apps/indexer/urql'
import { TaggedError } from '@ens-apps/utils/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { queryOptions, skipToken } from '@tanstack/react-query'
import { parse } from 'graphql'
import type { V2RoleAssignment } from '../../v2NameRoles'

type DashboardRoleAssignmentsQuery = {
  readonly roles: readonly Pick<EacRoleAssignment, 'name' | 'roleBitmap'>[]
}

type DashboardRoleAssignmentsQueryVariables = {
  readonly account: string
}

export class GetDashboardRoleAssignmentsError extends TaggedError(
  'GetDashboardRoleAssignmentsError',
)<{
  cause: unknown
}> {}

const DashboardRoleAssignmentsDocument = parse(/* GraphQL */ `
  query DashboardRoleAssignments($account: String!) {
    roles(account: $account) {
      name
      roleBitmap
    }
  }
`)

export const getDashboardRoleAssignments = async (
  account: string,
): Promise<V2RoleAssignment[]> => {
  try {
    const result = await indexerClient
      .query<
        DashboardRoleAssignmentsQuery,
        DashboardRoleAssignmentsQueryVariables
      >(DashboardRoleAssignmentsDocument, {
        account: account.toLowerCase(),
      })
      .toPromise()

    if (result.error) throw result.error
    if (!result.data) throw new Error('Indexer query returned no data')

    return result.data.roles.map(({ name, roleBitmap }) => ({
      name: name ?? null,
      roleBitmap,
    }))
  } catch (error) {
    throw new GetDashboardRoleAssignmentsError({ cause: error })
  }
}

export const getDashboardRoleAssignmentsForAddresses = async (
  accounts: readonly string[],
): Promise<V2RoleAssignment[]> => {
  const normalizedAccounts = Array.from(
    new Set(accounts.map((account) => account.toLowerCase())),
  )
  const roleAssignments = await Promise.all(
    normalizedAccounts.map(getDashboardRoleAssignments),
  )
  return roleAssignments.flat()
}

export const getDashboardRoleAssignmentsQuery = (
  accounts: readonly string[] | undefined,
) => {
  const normalizedAccounts = accounts?.map((account) => account.toLowerCase())

  return queryOptions({
    queryKey: qk('dashboard', 'role_assignments', {
      accounts: normalizedAccounts ?? [],
    }),
    queryFn:
      normalizedAccounts && normalizedAccounts.length > 0
        ? () => getDashboardRoleAssignmentsForAddresses(normalizedAccounts)
        : skipToken,
    meta: {
      dependsOn: ['indexer'],
    },
  })
}
