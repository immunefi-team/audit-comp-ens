import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetPremiumDecayParamsErrorType,
  getPremiumDecayParams,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import { publicClient } from '@/lib/wagmi'
import { ORACLE_PRICE_DECIMALS } from '../../workflow/pricing/lib/oracle'
import type { PremiumDecayConfig } from '../../workflow/pricing/lib/premiumDecay'

export class GetOracleParamsError extends TaggedError('GetOracleParamsError')<{
  readonly cause: GetPremiumDecayParamsErrorType
}> {}

export type OracleParams = {
  readonly premiumDecay: PremiumDecayConfig
}

export const getOracleParams = ResultFn(async function* () {
  const { priceInitial, halvingPeriod, period } = yield* fromPromise(
    getPremiumDecayParams(publicClient),
    (e) =>
      new GetOracleParamsError({ cause: e as GetPremiumDecayParamsErrorType }),
  )

  const premiumDecay: PremiumDecayConfig = {
    startPriceUsd: Number(priceInitial / 10n ** BigInt(ORACLE_PRICE_DECIMALS)),
    halvingPeriodMs: Number(halvingPeriod) * 1000,
    periodMs: Number(period) * 1000,
  }

  return ok<OracleParams>({ premiumDecay })
})

export const getOracleParamsQueryOptions = resultQueryOptions({
  queryKey: $qk({
    $service: 'standard-rent-price-oracle',
    $action: 'get-oracle-params',
  }),
  staleTime: Number.POSITIVE_INFINITY,
  queryFn: () => getOracleParams(),
})
