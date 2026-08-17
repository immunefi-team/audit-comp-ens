import { ResultFn } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { ok } from 'neverthrow'
import type { Address } from 'viem'
import { resolveAddressOrName } from '@/features/roles/helpers/addUser.handlers'
import { safeGetClient } from '@/lib/wagmi/helpers'

interface GetResolvedAddressParams {
  readonly nameOrAddress: string
}

/**
 * Resolve a name/address input (an ENS name or a 0x address) to an address.
 * Addresses pass through; names go through the universal resolver, falling
 * back to the ENS owner when the name has no address record.
 */
export const getResolvedAddress = ResultFn(async function* (
  params: GetResolvedAddressParams,
) {
  const client = yield* safeGetClient()

  // `resolveAddressOrName` resolves to `Address | null` and never throws (it
  // swallows resolution failures to null), so there's nothing to wrap in a
  // Result error here.
  const address = await resolveAddressOrName({
    client,
    nameOrAddress: params.nameOrAddress,
  })

  return ok<Address | null>(address)
})

const getResolvedAddressQueryKey = createQueryKey<
  'resolved-address',
  GetResolvedAddressParams
>('resolved-address')

export const getResolvedAddressQueryOptions = (
  params: GetResolvedAddressParams,
) =>
  resultQueryOptions({
    queryKey: getResolvedAddressQueryKey(params),
    queryFn: ({ queryKey: [, queryParams] }) => getResolvedAddress(queryParams),
  })
