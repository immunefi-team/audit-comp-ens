import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetSupportedInterfacesErrorType,
  type GetSupportedInterfacesParameters,
  getSupportedInterfaces,
} from '@ensdomains/ensjs/public'
import { useQuery } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { Hex } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

class SupportsInterfacesError extends TaggedError('SupportsInterfacesError')<{
  cause: GetSupportedInterfacesErrorType
}> {}

type GetSupportsInterfacesParameters = GetSupportedInterfacesParameters<Hex[]>

export const getSupportsInterfaces = ResultFn(async function* (
  params: GetSupportsInterfacesParameters,
) {
  const client = yield* safeGetClient()

  const interfaces = yield* await fromPromise(
    getSupportedInterfaces(client, params),
    (e) =>
      new SupportsInterfacesError({
        cause: e as GetSupportedInterfacesErrorType,
      }),
  )
  return ok(interfaces)
})

const supportsInterfacesQueryKey = createQueryKey<
  'supported-interfaces',
  GetSupportsInterfacesParameters
>('supported-interfaces')

export const getSupportsInterfacesQueryOptions = (
  params: GetSupportsInterfacesParameters,
) =>
  resultQueryOptions({
    queryKey: supportsInterfacesQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getSupportsInterfaces(params),
  })

export const useSupportsInterfaces = (
  params: GetSupportsInterfacesParameters,
) => {
  return useQuery(getSupportsInterfacesQueryOptions(params))
}
