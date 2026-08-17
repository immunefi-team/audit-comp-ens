import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { AssetGatewayUrls } from 'viem'
import { parseAvatarRecord } from 'viem/ens'
import { safeGetClient } from '@/lib/wagmi/helpers'

const IPFS_GATEWAY = 'https://ipfs.euc.li'

class ParseImageRecordError extends TaggedError('ParseImageRecordError')<{
  cause: unknown
}> {}

const buildGatewayUrls = (overrides?: AssetGatewayUrls): AssetGatewayUrls => ({
  ipfs: IPFS_GATEWAY,
  ...overrides,
})

export const parseImageRecord = ResultFn(async function* (
  record: string,
  gatewayUrls?: AssetGatewayUrls,
) {
  const client = yield* safeGetClient()

  const url = yield* fromPromise(
    parseAvatarRecord(client, {
      record,
      gatewayUrls: buildGatewayUrls(gatewayUrls),
    }),
    (e) => new ParseImageRecordError({ cause: e }),
  )

  return ok(url ?? null)
})

export const imageRecordQuery = (
  record: string | undefined,
  gatewayUrls?: AssetGatewayUrls,
) =>
  resultQueryOptions({
    queryKey: qk('profile', 'image_record', { record, gatewayUrls }),
    queryFn: record ? () => parseImageRecord(record, gatewayUrls) : skipToken,
  })
