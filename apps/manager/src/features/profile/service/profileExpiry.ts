import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import {
  getExpiry as ensjsv1_getExpiry,
  type GetExpiryErrorType as GetV1ExpiryErrorType,
  type GetExpiryReturnType as GetV1ExpiryReturnType,
} from '@ensdomains/ensjs/public/v1'
import {
  getExpiry as ensjsv2_getExpiry,
  type GetExpiryErrorType as GetV2ExpiryErrorType,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import {
  getNameExpiryStatus,
  type NameExpiryStatus,
} from '@/features/grace/utils/gracePeriod'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'
import { sepoliaWithEns } from '@/lib/wagmi'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { normalizeEth2LdName } from './profileName'
import { getOwner, type ProfileProtocol } from './profileOwner'

export const profileExpiryDateFromSeconds = (
  expirySeconds: number | bigint | null | undefined,
): Date | null => {
  if (expirySeconds == null) return null
  const date = new Date(Number(expirySeconds) * 1000)
  return Number.isNaN(date.getTime()) ? null : date
}

export const getProfileNameExpiryStatus = (
  expirySeconds: number | bigint | null | undefined,
  protocol: RenewalProtocol,
): NameExpiryStatus =>
  getNameExpiryStatus(profileExpiryDateFromSeconds(expirySeconds), protocol)

export type ProfileExpiryResult = {
  readonly expiry: bigint | null
  readonly isNonExpiring: boolean
  readonly protocol: 'v1' | 'v2'
}

export const getProfileExpiryResultStatus = (
  expiry: ProfileExpiryResult | null | undefined,
): NameExpiryStatus =>
  getProfileNameExpiryStatus(expiry?.expiry, expiry?.protocol ?? 'v2')

class GetProfileExpiryError extends TaggedError('GetProfileExpiryError')<{
  cause: GetV1ExpiryErrorType | GetV2ExpiryErrorType
}> {}

const ENS_REGISTRY = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensRegistry',
})

const normalizeV1Expiry = (
  expiry: GetV1ExpiryReturnType,
): ProfileExpiryResult => {
  if (expiry?.expiry === 0n) {
    return { expiry: null, isNonExpiring: true, protocol: 'v1' }
  }

  return {
    expiry: expiry?.expiry ?? null,
    isNonExpiring: false,
    protocol: 'v1',
  }
}

export const getExpiry = ResultFn(async function* (
  name: string,
  protocol?: ProfileProtocol,
) {
  const ethName = normalizeEth2LdName(name)

  if (!ethName) {
    return ok({
      expiry: null,
      isNonExpiring: false,
      protocol: 'v2',
    } satisfies ProfileExpiryResult)
  }

  const resolvedProtocol =
    protocol ?? (yield* getOwner({ name: ethName.name }))?.protocol ?? 'v2'

  const client = yield* safeGetClient()

  if (resolvedProtocol === 'v1') {
    const v1Expiry = yield* fromPromise(
      ensjsv1_getExpiry(client, { name: ethName.name }),
      (e) =>
        new GetProfileExpiryError({
          cause: e as GetV1ExpiryErrorType,
        }),
    )

    return ok(normalizeV1Expiry(v1Expiry))
  }

  const expiry = yield* fromPromise(
    ensjsv2_getExpiry(client, {
      name: ethName.name,
      registryAddress: ENS_REGISTRY,
    }),
    (e) => new GetProfileExpiryError({ cause: e as GetV2ExpiryErrorType }),
  )

  if (expiry !== 0n) {
    return ok({
      expiry,
      isNonExpiring: false,
      protocol: 'v2',
    } satisfies ProfileExpiryResult)
  }

  return ok({
    expiry: null,
    isNonExpiring: true,
    protocol: 'v2',
  } satisfies ProfileExpiryResult)
})

export const profileExpiryQuery = (name: string, protocol?: ProfileProtocol) =>
  resultQueryOptions({
    queryKey: qk('profile', 'expiry', { name, protocol }),
    queryFn: ({ queryKey: [{ name, protocol }] }) => getExpiry(name, protocol),
  })
