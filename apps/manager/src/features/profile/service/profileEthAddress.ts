import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { getRecords } from '@ensdomains/ensjs/public'
import { fromPromise, ok } from 'neverthrow'
import { type Address, getAddress, isAddress, zeroAddress } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

const ETH_COIN_TYPE = 60

class GetProfileEthAddressError extends TaggedError(
  'GetProfileEthAddressError',
)<{
  cause: unknown
}> {}

export type ProfileEthAddressSnapshot = {
  resolverAddress?: Address
  ethAddress?: Address
}

const normalizeAddress = (value: string | undefined): Address | undefined => {
  if (!value || !isAddress(value)) return undefined

  const address = getAddress(value)
  if (address.toLowerCase() === zeroAddress) return undefined

  return address
}

export const getProfileEthAddressSnapshot = ResultFn(async function* (
  name: string,
  resolverAddress?: Address,
) {
  const client = yield* safeGetClient()

  const records = yield* fromPromise(
    getRecords(client, {
      name,
      coins: [ETH_COIN_TYPE],
      ignoreInvalidCoinTypes: true,
      ...(resolverAddress
        ? {
            resolver: {
              address: resolverAddress,
            },
          }
        : {}),
    }),
    (e) => new GetProfileEthAddressError({ cause: e }),
  )

  const ethRecord = records.coins.find(
    (record) => record.coinType === ETH_COIN_TYPE,
  )

  return ok({
    resolverAddress: normalizeAddress(
      records.resolverAddress ?? resolverAddress,
    ),
    ethAddress: normalizeAddress(ethRecord?.value),
  })
})
