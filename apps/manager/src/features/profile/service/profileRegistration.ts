import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import {
  getRegistrationDate as ensjsv2_getRegistrationDate,
  type GetRegistrationDateErrorType,
} from '@ensdomains/ensjs/public/v2'
import {
  getNameHistory as ensjs_getNameHistory,
  type GetNameHistoryErrorType,
} from '@ensdomains/ensjs/subgraph'
import { err, fromPromise, ok } from 'neverthrow'
import { type GetBlockErrorType, getBlock } from 'viem/actions'
import { sepoliaWithEns } from '@/lib/wagmi'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { normalizeEth2LdName } from './profileName'
import { getOwner, type ProfileProtocol } from './profileOwner'

class GetProfileRegistrationError extends TaggedError(
  'GetProfileRegistrationError',
)<{
  cause:
    | GetRegistrationDateErrorType
    | GetNameHistoryErrorType
    | GetBlockErrorType
}> {}

class UnsafeRegistrationDateError extends TaggedError(
  'UnsafeRegistrationDateError',
)<{
  readonly registrationDate: string
}> {}

const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

const registrationDateToNumber = (registrationDate: bigint) => {
  if (
    registrationDate < MIN_SAFE_INTEGER_BIGINT ||
    registrationDate > MAX_SAFE_INTEGER_BIGINT
  ) {
    return err(
      new UnsafeRegistrationDateError({
        message: 'Registration date exceeds Number safe integer range',
        registrationDate: registrationDate.toString(),
      }),
    )
  }

  return ok(Number(registrationDate))
}

const ENS_REGISTRY = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensRegistry',
})

const blockNumberToBigInt = (blockNumber: number | bigint) =>
  typeof blockNumber === 'bigint' ? blockNumber : BigInt(blockNumber)

export const getRegistration = ResultFn(async function* (
  name: string,
  protocol?: ProfileProtocol,
) {
  const ethName = normalizeEth2LdName(name)

  if (!ethName) {
    return ok({ registrationDate: null })
  }

  const resolvedProtocol =
    protocol ?? (yield* getOwner({ name: ethName.name }))?.protocol ?? 'v2'

  const client = yield* safeGetClient()

  if (resolvedProtocol === 'v1') {
    const nameHistory = yield* fromPromise(
      ensjs_getNameHistory(client, {
        name: ethName.name,
        orderDirection: 'desc',
        first: 25,
      }),
      (e) =>
        new GetProfileRegistrationError({
          cause: e as GetNameHistoryErrorType,
        }),
    )

    const registrationBlockNumber = nameHistory?.registrationEvents?.find(
      (event) => event.type === 'NameRegistered',
    )?.blockNumber

    if (registrationBlockNumber == null) {
      return ok({ registrationDate: null })
    }

    const block = yield* fromPromise(
      getBlock(client, {
        blockNumber: blockNumberToBigInt(registrationBlockNumber),
      }),
      (e) =>
        new GetProfileRegistrationError({
          cause: e as GetBlockErrorType,
        }),
    )

    const safeRegistrationDate = yield* registrationDateToNumber(
      block.timestamp,
    )

    return ok({ registrationDate: safeRegistrationDate })
  }

  const registrationDate = yield* fromPromise(
    ensjsv2_getRegistrationDate(client, {
      label: ethName.label,
      registryAddress: ENS_REGISTRY,
    }),
    (e) =>
      new GetProfileRegistrationError({
        cause: e as GetRegistrationDateErrorType,
      }),
  )

  const safeRegistrationDate =
    registrationDate === null
      ? null
      : yield* registrationDateToNumber(registrationDate)

  return ok({ registrationDate: safeRegistrationDate })
})

export const profileRegistrationQuery = (
  name: string,
  protocol?: ProfileProtocol,
) =>
  resultQueryOptions({
    queryKey: qk('profile', 'registration', { name, protocol }),
    queryFn: ({ queryKey: [{ name, protocol }] }) =>
      getRegistration(name, protocol),
  })
