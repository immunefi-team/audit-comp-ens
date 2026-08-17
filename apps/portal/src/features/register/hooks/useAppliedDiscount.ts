import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type ApplyDiscountErrorType,
  applyDiscount,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class ApplyDiscountError extends TaggedError('ApplyDiscountError')<{
  readonly cause: ApplyDiscountErrorType
}> {}

export type DiscountInput = {
  /** Undiscounted value (e.g. baseRate × duration), in oracle units. */
  readonly value: bigint
  /** Term length, in seconds — selects the discount tier. */
  readonly duration: number
}

export const getAppliedDiscount = ResultFn(async function* ({
  value,
  duration,
}: DiscountInput) {
  const client = yield* safeGetClient()

  const result = yield* fromPromise(
    applyDiscount(client, { value, duration: BigInt(duration) }),
    (e) => new ApplyDiscountError({ cause: e as ApplyDiscountErrorType }),
  )

  return ok(result)
})

const getAppliedDiscountQueryKey = createQueryKey<
  'applied-discount',
  { readonly key: string }
>('applied-discount')

/**
 * Query options for a single `applyDiscount` call. Defined per-input so callers
 * can `useQueries` over many lookups — when one input changes, only that query
 * refetches. Calls are still JSON-RPC batched by the wagmi transport; the
 * discount curve is static config — cache forever.
 */
export const getAppliedDiscountQueryOptions = (input: DiscountInput) =>
  resultQueryOptions({
    queryKey: getAppliedDiscountQueryKey({
      key: `${input.value}:${input.duration}`,
    }),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: () => getAppliedDiscount(input),
  })
