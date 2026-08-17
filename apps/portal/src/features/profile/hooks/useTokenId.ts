import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetTokenIdErrorType,
  getTokenId,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class GetTokenIdError extends TaggedError('GetTokenIdError')<{
  cause: GetTokenIdErrorType
}> {}

export type GetTokenIdParameters = {
  label: string
  registryAddress: Address
}

export const getEnsTokenId = ResultFn(async function* ({
  label,
  registryAddress,
}: GetTokenIdParameters) {
  const client = yield* safeGetClient()

  const tokenId = yield* fromPromise(
    getTokenId(client, { label, registryAddress }),
    (e) => new GetTokenIdError({ cause: e as GetTokenIdErrorType }),
  )

  return ok(tokenId)
})

const getTokenIdQueryKey = createQueryKey<'get-token-id', GetTokenIdParameters>(
  'get-token-id',
)

export const getTokenIdQueryOptions = (params: GetTokenIdParameters) =>
  resultQueryOptions({
    queryKey: getTokenIdQueryKey(params),
    queryFn: () => getEnsTokenId(params),
  })
