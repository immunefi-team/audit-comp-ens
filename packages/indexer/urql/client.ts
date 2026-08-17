import {
  cacheExchange,
  createClient,
  fetchExchange,
  makeOperation,
  mapExchange,
} from '@urql/core'
import { retryExchange } from '@urql/exchange-retry'

/**
 * Resolve the indexer GraphQL URL.
 *
 * `import.meta.env.VITE_INDEXER_GRAPHQL_URL` is inlined by Vite at build time,
 * so it's available in both browser and SSR contexts. The only edge case is
 * relative paths (e.g. `/indexer/graphql`) which need a browser origin to
 * resolve — during SSR we fall back to the public URL instead.
 *
 * Absolute URLs (e.g. `http://127.0.0.1:5655/graphql`) work in both contexts.
 */
function getIndexerUrl(): string {
  try {
    if (typeof import.meta !== 'undefined') {
      const envUrl = import.meta.env?.VITE_INDEXER_GRAPHQL_URL
      if (envUrl) {
        // Relative paths only work in the browser (they need an origin).
        // During SSR, fall back to the public endpoint.
        if (envUrl.startsWith('/') && typeof window === 'undefined') {
          return 'https://staging-graphql.ens.dev/'
        }
        return envUrl
      }
    }
  } catch {
    // Non-Vite environment — fall through to default
  }
  return 'https://staging-graphql.ens.dev/'
}

export const INDEXER_GRAPHQL_URL = getIndexerUrl()

const forcePostExchange = mapExchange({
  onOperation(operation) {
    if (operation.kind !== 'query') return operation
    if (!operation.context.preferGetMethod) return operation

    return makeOperation(operation.kind, operation, {
      preferGetMethod: false,
    })
  },
})

export const createIndexerClient = () =>
  createClient({
    url: INDEXER_GRAPHQL_URL,
    requestPolicy: 'network-only',
    exchanges: [
      cacheExchange,
      forcePostExchange,
      retryExchange({
        initialDelayMs: 200,
        maxDelayMs: 5000,
        randomDelay: true,
        maxNumberAttempts: 3,
        retryIf: (error) => Boolean(error),
      }),
      fetchExchange,
    ],
  })

const indexerClient = createIndexerClient()

export default indexerClient
