import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getSubnames as ensjs_getSubnames,
  type GetSubnamesErrorType,
} from '@ensdomains/ensjs/subgraph'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import { type Address, checksumAddress, type Hex } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'
import { safeGetClient } from '@/lib/wagmi/helpers'
import type { ProtocolVersion } from '@/utils/types'

class GetSubnamesError extends TaggedError('GetSubnamesError')<{
  cause: GetSubnamesErrorType | ClientError
}> {}

type Subname = {
  name: string | null
  labelName: string | null
  labelhash: Hex
  owner: Address
}

type GetSubnamesParameters = {
  name: string
  protocolVersion: ProtocolVersion
}

export const getSubnames = ResultFn(async function* ({
  name,
  protocolVersion,
}: GetSubnamesParameters) {
  if (protocolVersion === 'ENSv1') {
    const client = yield* safeGetClient()

    const subnames = yield* fromPromise(
      ensjs_getSubnames(client, { name }),
      (e) =>
        new GetSubnamesError({
          cause: e as GetSubnamesErrorType,
        }),
    )

    return ok(subnames ?? [])
  } else {
    const v2Request = yield* fromPromise(
      graphqlIndexerClient.request<
        {
          domains: [
            {
              subdomains: (Omit<Subname, 'owner'> & {
                owner: { id: Address }
              })[]
            },
          ]
        },
        { name: string }
      >(
        gql`
      query getSubnames($name: String!) {
        domains(where: { name: $name }) {
          subdomains {
            name
            labelName
            labelhash
            owner {
              id
            }
          }
        }
      }`,
        { name },
      ),
      (e) => new GetSubnamesError({ cause: e as ClientError }),
    )

    const domain = v2Request.domains[0]
    const subnames = (domain?.subdomains ?? []).map(({ owner, ...name }) => ({
      ...name,
      owner: checksumAddress(owner.id),
    }))
    return ok(subnames)
  }
})

const getSubnamesQueryKey = createQueryKey<
  'get-subnames',
  GetSubnamesParameters
>('get-subnames')

export const getSubnamesQueryOptions = (params: GetSubnamesParameters) =>
  resultQueryOptions({
    queryKey: getSubnamesQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getSubnames(params),
  })
