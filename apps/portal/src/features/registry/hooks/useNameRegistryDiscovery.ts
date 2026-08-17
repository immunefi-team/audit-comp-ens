import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getNameRegistries as ensjsGetNameRegistries,
  type GetNameRegistriesErrorType,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

type GetNameRegistriesParameters = {
  name: string
}

type Root = [root: Address | null]
type TLD = [tld: Address, ...Root]
type TwoLD = [nameOrZero: Address, ...TLD]
type ThreeLD = [nameAddress: Address, ...TwoLD]
type FourLD = [nameAddress: Address, ...ThreeLD]
// Names deeper than 4LD: shape is `[name, ...ancestorRegistries, root]`.
// findRegistries returns one entry per label plus root, so a 5LD has 6
// elements, a 6LD has 7, etc. The discriminating tuple types above let
// callers match on the common 2-/3-/4LD shapes; anything deeper falls
// into this catch-all (5LD+ = at least 6 entries).
type FiveOrMoreLD = readonly [
  Address,
  Address,
  Address,
  Address,
  Address,
  Address,
  ...Address[],
]

export type NameRegistries =
  | Root
  | TLD
  | TwoLD
  | ThreeLD
  | FourLD
  | FiveOrMoreLD

class NameRegistriesError extends TaggedError('NameRegistriesError')<{
  cause: GetNameRegistriesErrorType
}> {}

/**
 * Discovers which registries a name exists on using the UniversalResolver V2.
 *
 * Should only be called for V2 names. V1 names don't have subregistries and
 * `findRegistries` returns identical (and meaningless) results for them, so
 * callers must guard with a V1/V2 check (see {@link getEnsOwner}) before
 * invoking this query.
 */
export const getNameRegistries = ResultFn(async function* ({
  name,
}: GetNameRegistriesParameters) {
  const client = yield* safeGetClient()

  const registries = (yield* fromPromise(
    ensjsGetNameRegistries(client, { name }),
    (e) => new NameRegistriesError({ cause: e as GetNameRegistriesErrorType }),
  )) as NameRegistries

  return ok(registries)
})

const nameRegistriesQueryKey = createQueryKey<
  'nameRegistries',
  GetNameRegistriesParameters
>('nameRegistries')

export const getNameRegistriesQueryOptions = (
  params: GetNameRegistriesParameters,
) =>
  resultQueryOptions({
    queryKey: nameRegistriesQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getNameRegistries(params),
  })
