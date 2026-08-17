import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetV2RegistrationDataError extends TaggedError(
  'GetV2RegistrationDataError',
)<{
  cause: ClientError
}> {}

type GetRegistrationDataParameters = { name: string }

const getV2RegistrationData = ResultFn(async function* ({
  name,
}: GetRegistrationDataParameters) {
  const { domains } = yield* fromPromise(
    graphqlIndexerClient.request<
      {
        domains:
          | [
              {
                createdAt: number
                registrationDate: number
                expiryDate: number
              },
            ]
          | []
      },
      { name: string }
    >(
      gql`
        query getRegistrationAndExpiry($name: String!) {
          domains(where: { name: $name }) {
            createdAt
            registrationDate
            expiryDate
          }
        }
      `,
      { name },
    ),
    (e) =>
      new GetV2RegistrationDataError({
        cause: e as ClientError,
      }),
  )

  const domain = domains[0]

  return ok({
    createdAt: domain?.createdAt || null,
    registeredAt: domain?.registrationDate || null,
    expiry: domain?.expiryDate || null,
  })
})

const getV2RegistrationDataQueryKey = createQueryKey<
  'get-v2-reg-data',
  GetRegistrationDataParameters
>('get-v2-reg-data')

export const getV2RegistrationDataQueryOptions = (
  params: GetRegistrationDataParameters,
) =>
  resultQueryOptions({
    queryKey: getV2RegistrationDataQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV2RegistrationData(params),
  })
