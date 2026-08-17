import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  type GetAvailableErrorType,
  getAvailable,
} from '@ensdomains/ensjs/public/v2'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class CheckNameAvailabilityError extends TaggedError(
  'CheckNameAvailabilityError',
)<{
  cause: GetAvailableErrorType
}> {}

type CheckNameAvailabilityParameters = {
  readonly name: string
}

export type CheckNameAvailabilityReturnType = {
  readonly isAvailable: boolean
  readonly name: string
}

/**
 * Check if a name is available for registration using the V2 ETHRegistrar.
 */
export const checkNameAvailability = ResultFn(async function* ({
  name,
}: CheckNameAvailabilityParameters) {
  const client = yield* safeGetClient()

  // Normalise the name to `<label>.eth` shape — the ensjs action accepts
  // eth-2ld names and rejects bare labels with `UnsupportedNameTypeError`.
  const cleanName = name.replace(/\.eth$/i, '')
  const fullName = `${cleanName}.eth`

  const isAvailable = yield* fromPromise(
    getAvailable(client, { name: fullName }),
    (e) =>
      new CheckNameAvailabilityError({ cause: e as GetAvailableErrorType }),
  )

  return ok<CheckNameAvailabilityReturnType>({
    isAvailable,
    name: fullName,
  })
})

const checkNameAvailabilityQueryKey = createQueryKey<
  'check-name-availability',
  CheckNameAvailabilityParameters
>('check-name-availability')

export const getNameAvailabilityQueryOptions = (
  params: CheckNameAvailabilityParameters,
) =>
  resultQueryOptions({
    queryKey: checkNameAvailabilityQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => checkNameAvailability(params),
  })
