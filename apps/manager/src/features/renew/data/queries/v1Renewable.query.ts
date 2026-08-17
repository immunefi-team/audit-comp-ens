import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  isRenewable as ensjsIsRenewable,
  type IsRenewableErrorType,
} from '@ensdomains/ensjs/public/v2'
import { useQueries } from '@tanstack/react-query'
import { err, fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { parseRenewableName } from '../../utils/renewableName'
import { getRenewerAddress } from '../../utils/renewalProtocol'

class IsV1RenewableError extends TaggedError('IsV1RenewableError')<{
  readonly cause: unknown
}> {}

export const getIsV1Renewable = ResultFn(async function* (name: string) {
  const parsedName = parseRenewableName(name)
  if (parsedName.isErr()) {
    return err(new IsV1RenewableError({ cause: parsedName.error }))
  }

  const client = yield* safeGetClient()
  const renewable = yield* fromPromise(
    ensjsIsRenewable(client, {
      renewerAddress: getRenewerAddress('v1'),
      label: parsedName.value.label,
    }),
    (cause) => new IsV1RenewableError({ cause: cause as IsRenewableErrorType }),
  )

  return ok(renewable)
})

export const getV1RenewableQueryOptions = (name: string) => {
  const protocol = 'v1' as const
  const renewerAddress = getRenewerAddress(protocol)

  return resultQueryOptions({
    queryKey: $qk({
      $action: 'is-renewable',
      name,
      protocol,
      renewerAddress,
    }),
    queryFn: () => getIsV1Renewable(name),
  })
}

export const useV1Renewable = (names: readonly string[]) => {
  const queries = useQueries({
    queries: names.map(getV1RenewableQueryOptions),
  })
  const renewableNames = new Set(
    names.filter((_, index) => queries[index]?.data === true),
  )

  return {
    isLoading: queries.some((query) => query.isLoading),
    isRenewable: (name: string) => renewableNames.has(name),
  }
}
