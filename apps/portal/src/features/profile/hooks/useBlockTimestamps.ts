import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { useQuery } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import { type GetBlockErrorType, getBlock } from 'viem/actions'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetBlockTimestampsError extends TaggedError('GetBlockTimestampsError')<{
  cause: GetBlockErrorType
}> {}

type GetBlockTimestampsParameters = {
  blocks: bigint[]
}

export const getBlockTimestamps = ResultFn(async function* ({
  blocks,
}: GetBlockTimestampsParameters) {
  const client = yield* safeGetClient()

  const uniqueBlocks = [...new Set(blocks)]

  const result = yield* fromPromise(
    Promise.all(
      uniqueBlocks.map(async (blockNumber) => {
        const block = await getBlock(client, { blockNumber })
        return [blockNumber, block.timestamp] as const
      }),
    ),
    (e) => new GetBlockTimestampsError({ cause: e as GetBlockErrorType }),
  )

  return ok(new Map(result))
})

const getBlockTimestampsQueryKey = createQueryKey<
  'getBlockTimestampsQueryKey',
  GetBlockTimestampsParameters
>('getBlockTimestampsQueryKey')

const getBlockTimestampsQueryOptions = (params: GetBlockTimestampsParameters) =>
  resultQueryOptions({
    queryKey: getBlockTimestampsQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getBlockTimestamps(params),
  })

export const useBlockTimestamps = (
  params: GetBlockTimestampsParameters & { enabled?: boolean },
) => {
  const { enabled = true, ...queryParams } = params
  return useQuery({
    ...getBlockTimestampsQueryOptions(queryParams),
    enabled,
  })
}
