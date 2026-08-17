import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { useQuery } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hash } from 'viem'
import { type GetTransactionErrorType, getTransaction } from 'viem/actions'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetTransactionSendersError extends TaggedError(
  'GetTransactionSendersError',
)<{
  cause: GetTransactionErrorType
}> {}

type GetTransactionSendersParameters = {
  transactionHashes: Hash[]
}

const getTransactionSenders = ResultFn(async function* ({
  transactionHashes,
}: GetTransactionSendersParameters) {
  const client = yield* safeGetClient()

  const uniqueHashes = [...new Set(transactionHashes)]

  const result = yield* fromPromise(
    Promise.all(
      uniqueHashes.map(async (hash) => {
        const tx = await getTransaction(client, { hash })
        return { hash, from: tx.from }
      }),
    ),
    (e) =>
      new GetTransactionSendersError({
        cause: e as GetTransactionErrorType,
      }),
  )

  const senders = new Map<Hash, Address>()
  for (const { hash, from } of result) {
    senders.set(hash, from)
  }

  return ok(senders)
})

const getTransactionSendersQueryKey = createQueryKey<
  'getTransactionSendersQueryKey',
  GetTransactionSendersParameters
>('getTransactionSendersQueryKey')

const getTransactionSendersQueryOptions = (
  params: GetTransactionSendersParameters,
) =>
  resultQueryOptions({
    queryKey: getTransactionSendersQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getTransactionSenders(params),
  })

export const useTransactionSenders = (
  params: GetTransactionSendersParameters,
) => useQuery(getTransactionSendersQueryOptions(params))
