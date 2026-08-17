import { fromSync, ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type { UnsupportedNameTypeError } from '@ensdomains/ensjs'
import {
  type GetRegisterPriceErrorType,
  type GetRenewPriceErrorType,
  getRegisterPrice,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import { getTokenMetadataWithAddress } from '@/features/register/utils/tokenLookup'
import { SUPPORTED_TOKENS } from '@/lib/constants/tokens'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { getLabel } from '@/utils/token/getLabel'
import type { SupportedTokenAddresses } from '../types/tokens'

// Shared by register + renew pricing (same rent-price oracle). The cause union
// covers renewals (`GetRenewPriceErrorType`), constructed from `useRenewalPrice`.
export class GetRegistrationPriceError extends TaggedError(
  'GetRegistrationPriceError',
)<{
  readonly cause:
    | GetRegisterPriceErrorType
    | GetRenewPriceErrorType
    | UnsupportedNameTypeError
}> {}

export type BasePriceParameters = {
  readonly name: string
  readonly duration: number
  readonly token?: SupportedTokenAddresses
}

export type RegistrationPriceParameters = BasePriceParameters

export type RegistrationPriceResult = {
  readonly base: bigint
  readonly premium: bigint
  readonly total: bigint
  readonly decimals: number
  readonly hasPremium: boolean
}

// Inputs shared by both price paths (register + renew): client, normalized
// label, the payment token (+ its decimals), and the duration as a bigint.
export const resolvePriceInputs = ResultFn(async function* ({
  name,
  duration,
  token,
}: BasePriceParameters) {
  const client = yield* safeGetClient()
  const paymentToken = token ?? SUPPORTED_TOKENS.USDC
  const label = yield* fromSync(
    () => getLabel(name),
    (cause) =>
      new GetRegistrationPriceError({
        cause: cause as UnsupportedNameTypeError,
      }),
  )
  return ok({
    client,
    paymentToken,
    label,
    duration: BigInt(duration),
    decimals: getTokenMetadataWithAddress(paymentToken).decimals,
  })
})

/**
 * `getRegisterPrice` returns (base, premium) — the ENSv2 `ETHRegistrar` derives
 * the temporary premium from on-chain state (time since `expiry + GRACE_PERIOD`)
 * and returns it unconditionally, so no caller-supplied owner is needed. Pricing
 * is delegated to ensjs and reverts if the name isn't registerable.
 */
export const getRegistrationPrice = ResultFn(async function* (
  params: RegistrationPriceParameters,
) {
  const { client, paymentToken, label, duration, decimals } =
    yield* resolvePriceInputs(params)

  const { base, premium } = yield* fromPromise(
    getRegisterPrice(client, { label, duration, paymentToken }),
    (e) =>
      new GetRegistrationPriceError({ cause: e as GetRegisterPriceErrorType }),
  )

  return ok<RegistrationPriceResult>({
    base,
    premium,
    total: base + premium,
    decimals,
    hasPremium: premium > 0n,
  })
})

const getRegistrationPriceQueryKey = createQueryKey<
  'get-registration-price',
  RegistrationPriceParameters
>('get-registration-price')

export const getRegistrationPriceQueryOptions = (
  params: RegistrationPriceParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistrationPriceQueryKey(params),
    queryFn: () => getRegistrationPrice(params),
  })
