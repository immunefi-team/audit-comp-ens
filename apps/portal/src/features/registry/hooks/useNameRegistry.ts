import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getNameRegistryAddress as ensjs_getNameRegistryAddress,
  type GetNameRegistryAddressErrorType,
  type GetNameRegistryAddressParameters,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

class NameRegistryError extends TaggedError('nameRegistryError')<{
  cause: GetNameRegistryAddressErrorType
}> {}

type GetNameRegistryReturnType = {
  registryAddress: Address
  parentRegistryAddress: Address
}

/**
 * Fetches name subregistry and ETH registry
 */
const getNameRegistry = ResultFn(async function* (
  params: GetNameRegistryAddressParameters,
) {
  const client = yield* safeGetClient()

  const registryAddress = yield* fromPromise(
    ensjs_getNameRegistryAddress(client, params),
    (e) =>
      new NameRegistryError({ cause: e as GetNameRegistryAddressErrorType }),
  )

  return ok<GetNameRegistryReturnType>({
    registryAddress,
    parentRegistryAddress: params.registryAddress,
  })
})

// Query key factory
const nameRegistryQueryKey = createQueryKey<
  'nameRegistry',
  GetNameRegistryAddressParameters
>('nameRegistry')

// React Query options for fetching name registries
export const getNameRegistryQueryOptions = (
  params: GetNameRegistryAddressParameters,
) =>
  resultQueryOptions({
    queryKey: nameRegistryQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getNameRegistry(params),
  })
