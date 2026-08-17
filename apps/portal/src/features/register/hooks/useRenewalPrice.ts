import { ResultFn } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetRenewPriceErrorType,
  getRenewPrice,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import {
  type BasePriceParameters,
  GetRegistrationPriceError,
  type RegistrationPriceResult,
  resolvePriceInputs,
} from './useRegistrationPrice'

export type RenewalPriceParameters = BasePriceParameters & {
  /**
   * Renewer to price against — v2 `ETHRegistrar` for migrated/v2 names, v1
   * `ETHRenewerV1` for unmigrated v1 names. Required (no default) so a v1 name
   * can never silently price against the v2 registrar.
   */
  readonly renewerAddress: Address
}

/**
 * `getRenewPrice` returns a single amount — renewals are premium-exempt. Pricing
 * is delegated to ensjs and reverts if the name isn't renewable via the renewer.
 */
export const getRenewalPrice = ResultFn(async function* (
  params: RenewalPriceParameters,
) {
  const { client, paymentToken, label, duration, decimals } =
    yield* resolvePriceInputs(params)

  const { amount } = yield* fromPromise(
    getRenewPrice(client, {
      renewerAddress: params.renewerAddress,
      label,
      duration,
      paymentToken,
    }),
    (e) =>
      new GetRegistrationPriceError({ cause: e as GetRenewPriceErrorType }),
  )

  return ok<RegistrationPriceResult>({
    base: amount,
    premium: 0n,
    total: amount,
    decimals,
    hasPremium: false,
  })
})

const getRenewalPriceQueryKey = createQueryKey<
  'get-renewal-price',
  RenewalPriceParameters
>('get-renewal-price')

export const getRenewalPriceQueryOptions = (params: RenewalPriceParameters) =>
  resultQueryOptions({
    queryKey: getRenewalPriceQueryKey(params),
    queryFn: () => getRenewalPrice(params),
  })
