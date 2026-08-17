import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { getNameRolesForAccount as ensjsGetNameRolesForAccount } from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetNameRolesForAccountError extends TaggedError(
  'GetNameRolesForAccountError',
)<{
  cause: unknown
}> {}

type GetNameRolesForAccountParameters = {
  registryAddress: Address
  label: string
  account: Address
}

const getNameRolesForAccount = ResultFn(async function* ({
  registryAddress,
  label,
  account,
}: GetNameRolesForAccountParameters) {
  const client = yield* safeGetClient()

  const result = yield* await fromPromise(
    ensjsGetNameRolesForAccount(client, {
      registryAddress,
      label,
      account,
    }),
    (e) => new GetNameRolesForAccountError({ cause: e }),
  )

  return ok(result)
})

const getNameRolesForAccountQueryKey = createQueryKey<
  'getNameRolesForAccount',
  GetNameRolesForAccountParameters
>('getNameRolesForAccount')

export const getNameRolesForAccountQueryOptions = (
  params: GetNameRolesForAccountParameters,
) =>
  resultQueryOptions({
    queryKey: getNameRolesForAccountQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getNameRolesForAccount(params),
  })
