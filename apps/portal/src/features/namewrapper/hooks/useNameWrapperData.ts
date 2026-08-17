import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import {
  type GetWrapperDataErrorType,
  getWrapperData,
} from '@ensdomains/ensjs/public/v1'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class GetNameWrapperDataError extends TaggedError(
  'GetNameWrapperDataError',
)<{
  cause: GetWrapperDataErrorType
}> {}

export type GetNameWrapperDataParameters = {
  name: string
}

export const getNameWrapperData = ResultFn(async function* ({
  name,
}: GetNameWrapperDataParameters) {
  const client = yield* safeGetClient()

  const result = yield* fromPromise(
    getWrapperData(client, { name }),
    (e) => new GetNameWrapperDataError({ cause: e as GetWrapperDataErrorType }),
  )

  return ok(result)
})
