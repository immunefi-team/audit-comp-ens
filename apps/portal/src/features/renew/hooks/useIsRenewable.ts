import { fromSync, ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type { UnsupportedNameTypeError } from '@ensdomains/ensjs'
import {
  isRenewable as ensjs_isRenewable,
  type IsRenewableErrorType,
} from '@ensdomains/ensjs/public/v2'
import { useQueries } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { getLabel } from '@/utils/token/getLabel'
import { getRenewerAddress } from '../utils/renewer'

export type GetIsRenewableParameters = {
  /** Renewer contract to query — v2 `ETHRegistrar` or v1 `ETHRenewerV1`. */
  readonly renewerAddress: Address
  /** Full 2LD .eth name; the bare label is derived for the contract call. */
  readonly name: string
}

class IsRenewableError extends TaggedError('IsRenewableError')<{
  readonly cause: IsRenewableErrorType | UnsupportedNameTypeError
}> {}

/**
 * Whether the renewer will renew this name right now, via its on-chain
 * `isRenewable`. For unmigrated v1 names the renewer is `ETHRenewerV1`, which only
 * renews RESERVED (premigrated) or in-grace names, so a name with no reservation
 * returns `false`. Any read/normalization failure surfaces as the query error;
 * callers treat that (and `false`) as "not renewable" and hide the Extend flow.
 */
const getIsRenewable = ResultFn(async function* ({
  renewerAddress,
  name,
}: GetIsRenewableParameters) {
  const client = yield* safeGetClient()
  const label = yield* fromSync(
    () => getLabel(name),
    (cause) =>
      new IsRenewableError({ cause: cause as UnsupportedNameTypeError }),
  )
  const renewable = yield* fromPromise(
    ensjs_isRenewable(client, { renewerAddress, label }),
    (cause) => new IsRenewableError({ cause: cause as IsRenewableErrorType }),
  )
  return ok(renewable)
})

const getIsRenewableQueryKey = createQueryKey<
  'is-renewable',
  GetIsRenewableParameters
>('is-renewable')

export const getIsRenewableQueryOptions = (params: GetIsRenewableParameters) =>
  resultQueryOptions({
    queryKey: getIsRenewableQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getIsRenewable(params),
  })

export type UseV1RenewableResult = {
  /** True only once the name's query has resolved to `true`. */
  readonly isRenewable: (name: string) => boolean
  /** True while any name's `isRenewable` query is still resolving. */
  readonly isLoading: boolean
}

/**
 * On-chain `isRenewable` for a set of unmigrated v1 `.eth` names (queried against
 * `ETHRenewerV1`). Shared by the name page (`useCanExtend`) and the names table
 * (`useRenewableNames`) so both apply the identical policy: a name counts as
 * renewable only once its query resolves to `true`; while loading or on error it
 * is treated as not renewable. Pass only the v1 names you want gated — an empty
 * list issues no queries and reports `isLoading: false`.
 */
export function useV1Renewable(names: readonly string[]): UseV1RenewableResult {
  const queries = useQueries({
    queries: names.map((name) =>
      getIsRenewableQueryOptions({
        renewerAddress: getRenewerAddress(false),
        name,
      }),
    ),
  })
  const renewable = new Set(names.filter((_, i) => queries[i]?.data === true))
  const isLoading = queries.some((query) => query.isLoading)
  return { isRenewable: (name) => renewable.has(name), isLoading }
}
