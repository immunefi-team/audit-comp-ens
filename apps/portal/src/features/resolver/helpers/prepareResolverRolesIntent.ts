import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import { match } from 'ts-pattern'
import type { Address } from 'viem'
import type { IntentContext } from '@/features/transaction-manager/types'
import type { ResolverRoleKey } from '@/lib/roles/resolverRoles'
import { prepareGrantResolverRolesTransaction } from './grantResolverRoles'
import { prepareRevokeResolverRolesTransaction } from './revokeResolverRoles'

/** A pending resolver-roles edit awaiting confirmation in the sidebar. */
export type ResolverRolesAction =
  | {
      readonly type: 'save'
      readonly name: string
      readonly account: Address
      readonly rolesToGrant: ResolverRole[]
      readonly rolesToRevoke: ResolverRoleKey[]
    }
  | {
      readonly type: 'remove'
      readonly name: string
      readonly account: Address
      readonly roles: readonly ResolverRoleKey[]
    }

/**
 * The prepared intent for a pending resolver-roles action, for the modal's
 * pre-start gas estimate. Returns `undefined` when the action can't be
 * represented by a single call — a "save" that both grants and revokes submits
 * two transactions under one step, so it's estimated once each starts.
 */
export const prepareResolverRolesIntent = (
  action: ResolverRolesAction,
  resolverAddress: Address,
  { walletClient, chainId }: IntentContext,
): CustomTransactionIntent | undefined =>
  match(action)
    .with({ type: 'remove' }, ({ name, account, roles }) =>
      prepareRevokeResolverRolesTransaction({
        resolverAddress,
        name,
        account,
        roles,
        walletClient,
        chainId,
      }),
    )
    .with(
      { type: 'save' },
      ({ name, account, rolesToGrant, rolesToRevoke }) => {
        if (rolesToGrant.length > 0 && rolesToRevoke.length > 0)
          return undefined
        if (rolesToGrant.length > 0) {
          return prepareGrantResolverRolesTransaction({
            resolverAddress,
            name,
            account,
            roles: rolesToGrant,
            walletClient,
            chainId,
          })
        }
        if (rolesToRevoke.length > 0) {
          return prepareRevokeResolverRolesTransaction({
            resolverAddress,
            name,
            account,
            roles: rolesToRevoke,
            walletClient,
            chainId,
          })
        }
        return undefined
      },
    )
    .exhaustive()
