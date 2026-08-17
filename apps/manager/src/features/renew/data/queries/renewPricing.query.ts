import {
  type SUPPORTED_TOKEN,
  TOKENS,
} from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetRenewPriceErrorType as EnsGetRenewPriceErrorType,
  getRenewPrice as ensGetRenewPrice,
} from '@ensdomains/ensjs/public/v2'
import { err, fromPromise, ok } from 'neverthrow'
import { MissingTokenError } from '@/features/register-v2/data/queries/pricing.query'
import {
  getRenewerAddress,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'
import { publicClient } from '@/lib/wagmi'

export class GetRenewPriceError extends TaggedError('GetRenewPriceError')<{
  readonly cause: EnsGetRenewPriceErrorType
}> {}

export { MissingTokenError }

export const getRenewPrice = ResultFn(async function* (
  label: string,
  durationInSeconds: bigint,
  token: SUPPORTED_TOKEN | undefined,
  protocol: RenewalProtocol,
) {
  if (!token) {
    return err(new MissingTokenError({}))
  }

  const price = yield* fromPromise(
    ensGetRenewPrice(publicClient, {
      renewerAddress: getRenewerAddress(protocol),
      label,
      duration: durationInSeconds,
      paymentToken: TOKENS[token].address,
    }),
    (cause) =>
      new GetRenewPriceError({
        cause: cause as EnsGetRenewPriceErrorType,
      }),
  )

  return ok(price)
})

export const getRenewPriceQueryOptions = (
  label: string,
  durationInSeconds: bigint,
  token: SUPPORTED_TOKEN | undefined,
  protocol: RenewalProtocol,
) => {
  const renewerAddress = getRenewerAddress(protocol)

  return resultQueryOptions({
    queryKey: $qk({
      $action: 'get-renew-price',
      label,
      durationInSeconds: durationInSeconds.toString(),
      token,
      protocol,
      renewerAddress,
    }),
    queryFn: () => getRenewPrice(label, durationInSeconds, token, protocol),
  })
}
