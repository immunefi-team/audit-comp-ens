import type { V1Domain } from '@ens-apps/migration'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'

export type { V1Domain }

const V1_SUBGRAPH_URL = 'https://v1-graphql.ens.dev/subgraph'

type V1SubgraphResponse = {
  data: {
    domains: V1Domain[]
  }
  errors?: Array<{ message: string }>
}

class GetV1NamesError extends TaggedError('GetV1NamesError')<{
  cause: unknown
}> {}

const PAGE_SIZE = 1000

const GET_NAMES_QUERY = `
query getNamesForAddress($orderBy: Domain_orderBy, $orderDirection: OrderDirection, $first: Int, $skip: Int, $whereFilter: Domain_filter) {
  domains(
    orderBy: $orderBy
    orderDirection: $orderDirection
    first: $first
    skip: $skip
    where: $whereFilter
  ) {
    id
    labelName
    labelhash
    name
    resolver { address }
    owner { id }
    registrant { id }
    wrappedOwner { id }
    parent { name wrappedDomain { fuses } }
    registration {
      expiryDate
    }
    wrappedDomain {
      expiryDate
      fuses
    }
  }
}
`

const fetchPage = async (
  addr: string,
  now: string,
  idCursor: string | undefined,
): Promise<V1Domain[]> => {
  const baseFilters: Record<string, unknown>[] = [
    {
      or: [{ owner: addr }, { registrant: addr }, { wrappedOwner: addr }],
    },
    {
      parent_not:
        '0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2',
    },
    {
      or: [{ expiryDate_gt: now }, { expiryDate: null }],
    },
    {
      or: [
        {
          owner_not: '0x0000000000000000000000000000000000000000',
        },
        { resolver_not: null },
        {
          and: [
            {
              registrant_not: '0x0000000000000000000000000000000000000000',
            },
            { registrant_not: null },
          ],
        },
      ],
    },
  ]

  if (idCursor !== undefined) {
    baseFilters.push({ id_gt: idCursor })
  }

  const response = await fetch(V1_SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: GET_NAMES_QUERY,
      variables: {
        orderBy: 'id',
        orderDirection: 'asc',
        first: PAGE_SIZE,
        whereFilter: { and: baseFilters },
      },
      operationName: 'getNamesForAddress',
    }),
  })

  if (!response.ok) {
    throw new Error(`V1 subgraph request failed: ${response.status}`)
  }
  const json: V1SubgraphResponse = await response.json()
  if (json.errors?.length && json.errors[0]) {
    throw new Error(`V1 subgraph error: ${json.errors[0].message}`)
  }
  return json.data.domains
}

export const getV1NamesForAddress = ResultFn(async function* (address: string) {
  const now = Math.floor(Date.now() / 1000).toString()
  const addr = address.toLowerCase()

  const result = yield* fromPromise(
    (async () => {
      const allDomains: V1Domain[] = []
      let idCursor: string | undefined

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const page = await fetchPage(addr, now, idCursor)
        allDomains.push(...page)
        if (page.length < PAGE_SIZE) break
        idCursor = page[page.length - 1]?.id
      }

      return allDomains
    })(),
    (error) => new GetV1NamesError({ cause: error }),
  )

  return ok(result)
})

const GET_PROFILES_QUERY = `
query getProfilesForDomains($whereFilter: Domain_filter) {
  domains(where: $whereFilter, first: 1000) {
    id
    resolver {
      texts
      coinTypes
      contentHash
      abiChangeds(first: 1000) {
        contentType
      }
    }
  }
}
`

export type V1ProfileKeys = {
  readonly id: string
  readonly texts: readonly string[]
  readonly coinTypes: readonly number[]
  readonly contentHash: string | null
  readonly abiContentTypes: readonly bigint[]
}

export const hasV1ProfileRecords = (keys: V1ProfileKeys): boolean =>
  keys.texts.length > 0 ||
  keys.coinTypes.length > 0 ||
  (keys.contentHash !== null && keys.contentHash !== '0x') ||
  keys.abiContentTypes.length > 0

class GetV1ProfilesError extends TaggedError('GetV1ProfilesError')<{
  cause: unknown
}> {}

const PROFILE_KEYS_CHUNK = 500

const fetchProfileKeysChunk = async (
  ids: readonly string[],
): Promise<V1ProfileKeys[]> => {
  const response = await fetch(V1_SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: GET_PROFILES_QUERY,
      variables: { whereFilter: { id_in: ids } },
      operationName: 'getProfilesForDomains',
    }),
  })
  if (!response.ok) {
    throw new Error(`V1 subgraph request failed: ${response.status}`)
  }
  const json = (await response.json()) as {
    data?: {
      domains: readonly {
        id: string
        resolver: {
          texts: readonly string[] | null
          coinTypes: readonly number[] | null
          contentHash: string | null
          abiChangeds: readonly { contentType: string }[]
        } | null
      }[]
    }
    errors?: readonly { message: string }[]
  }
  if (json.errors?.length && json.errors[0]) {
    throw new Error(`V1 subgraph error: ${json.errors[0].message}`)
  }
  return (json.data?.domains ?? []).map(
    (d): V1ProfileKeys => ({
      id: d.id,
      texts: d.resolver?.texts ?? [],
      coinTypes: d.resolver?.coinTypes ?? [],
      contentHash: d.resolver?.contentHash ?? null,
      abiContentTypes: [
        ...new Set(
          (d.resolver?.abiChangeds ?? []).map(({ contentType }) =>
            BigInt(contentType),
          ),
        ),
      ],
    }),
  )
}

export const getV1ProfileKeys = ResultFn(async function* (
  domainIds: readonly string[],
) {
  if (domainIds.length === 0) return ok([] as V1ProfileKeys[])

  const result = yield* fromPromise(
    (async () => {
      const lowered = domainIds.map((id) => id.toLowerCase())
      const chunks: string[][] = []
      for (let i = 0; i < lowered.length; i += PROFILE_KEYS_CHUNK) {
        chunks.push(lowered.slice(i, i + PROFILE_KEYS_CHUNK))
      }
      const chunkResults = await Promise.all(chunks.map(fetchProfileKeysChunk))
      return chunkResults.flat()
    })(),
    (error) => new GetV1ProfilesError({ cause: error }),
  )

  return ok(result)
})
