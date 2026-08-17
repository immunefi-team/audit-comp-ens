import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useQuery } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hex } from 'viem'
import { getStorageAt } from 'viem/actions'
import { decodeImplementationAddress } from '@/features/resolver/utils/permissionedResolver'
import { sepoliaWithEns } from '@/lib/wagmi'
import { safeGetClient } from '@/lib/wagmi/helpers'

const EIP1967_IMPLEMENTATION_SLOT: Hex =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

const knownPermissionedResolverImplementations = [
  getChainContractAddress({
    chain: sepoliaWithEns,
    contract: 'ensPermissionedResolverImpl',
  }),
]
  .filter(Boolean)
  .map((address) => address.toLowerCase())

class IsPermissionedResolverError extends TaggedError(
  'IsPermissionedResolverError',
)<{
  cause: unknown
}> {}

interface GetIsPermissionedResolverParams {
  readonly resolverAddress: Address
}

export const getIsPermissionedResolver = ResultFn(async function* (
  params: GetIsPermissionedResolverParams,
) {
  const normalizedResolverAddress = params.resolverAddress.toLowerCase()
  if (
    knownPermissionedResolverImplementations.includes(normalizedResolverAddress)
  )
    return ok(true)

  const client = yield* safeGetClient()

  const implementationSlotValue = yield* fromPromise(
    getStorageAt(client, {
      address: params.resolverAddress,
      slot: EIP1967_IMPLEMENTATION_SLOT,
    }),
    (error) =>
      new IsPermissionedResolverError({
        cause: error,
      }),
  )

  const implementationAddress = decodeImplementationAddress(
    implementationSlotValue,
  )
  if (!implementationAddress) return ok(false)

  return ok(
    knownPermissionedResolverImplementations.includes(
      implementationAddress.toLowerCase(),
    ),
  )
})

const getIsPermissionedResolverQueryKey = createQueryKey<
  'is-permissioned-resolver',
  GetIsPermissionedResolverParams
>('is-permissioned-resolver')

export const getIsPermissionedResolverQueryOptions = (
  params: GetIsPermissionedResolverParams,
) =>
  resultQueryOptions({
    queryKey: getIsPermissionedResolverQueryKey(params),
    queryFn: ({ queryKey: [, queryParams] }) =>
      getIsPermissionedResolver(queryParams),
  })

export const useIsPermissionedResolver = (
  params: GetIsPermissionedResolverParams,
) => useQuery(getIsPermissionedResolverQueryOptions(params))
