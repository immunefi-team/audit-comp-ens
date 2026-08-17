import { DomainDocument, type DomainQuery } from '@ens-apps/indexer'
import indexerClient from '@ens-apps/indexer/urql'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { getOwner as ensjsv1_getOwner } from '@ensdomains/ensjs/public/v1'
import { getOwner as ensjsv2_getOwner } from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import { type Address, namehash, zeroAddress } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { normalizeDnsName, normalizeEthName } from './profileName'

class GetOwnerError extends TaggedError('GetOwnerError')<{
  cause: unknown
}> {}

export type ProfileProtocol = 'v1' | 'v2'

export type ProfileOwnerResult = {
  readonly owner: Address | undefined
  readonly protocol: ProfileProtocol
}

export const getOwner = ResultFn(async function* (params: { name: string }) {
  const ethName = normalizeEthName(params.name)

  // Non-.eth names (imported DNS names) only exist in the v1 registry;
  // the v2 registry is rooted at .eth
  if (!ethName) {
    const dnsName = normalizeDnsName(params.name)

    if (!dnsName) {
      return ok(null)
    }

    const client = yield* safeGetClient()

    const dnsOwner = yield* fromPromise(
      ensjsv1_getOwner(client, { name: dnsName }),
      (e) => new GetOwnerError({ cause: e }),
    )

    if (dnsOwner?.owner && dnsOwner.owner !== zeroAddress) {
      return ok({
        owner: dnsOwner.owner,
        protocol: 'v1',
      } satisfies ProfileOwnerResult)
    }

    return ok(null)
  }

  const client = yield* safeGetClient()

  const v2Owner = yield* fromPromise(
    ensjsv2_getOwner(client, { name: ethName.name }),
    (e) => new GetOwnerError({ cause: e }),
  )

  if (v2Owner && v2Owner !== zeroAddress) {
    return ok({
      owner: v2Owner,
      protocol: 'v2',
    } satisfies ProfileOwnerResult)
  }

  if (ethName.parentLabelsRootFirst.length === 0) {
    const v2Domain = yield* fromPromise(
      indexerClient
        .query<DomainQuery>(DomainDocument, { id: namehash(ethName.name) })
        .toPromise()
        .then((result) => {
          if (result.error) throw result.error
          return result.data?.domain ?? null
        }),
      (e) => new GetOwnerError({ cause: e }),
    )

    if (v2Domain) {
      return ok({
        owner: undefined,
        protocol: 'v2',
      } satisfies ProfileOwnerResult)
    }
  }

  const v1Owner = yield* fromPromise(
    ensjsv1_getOwner(client, { name: ethName.name }),
    (e) => new GetOwnerError({ cause: e }),
  )

  if (v1Owner?.owner && v1Owner.owner !== zeroAddress) {
    return ok({
      owner: v1Owner.owner,
      protocol: 'v1',
    } satisfies ProfileOwnerResult)
  }

  return ok(null)
})

export const profileOwnerQuery = (name: string) =>
  resultQueryOptions({
    queryKey: qk('profile', 'owner', { name }),
    queryFn: () => getOwner({ name }),
  })
