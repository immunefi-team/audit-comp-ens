import {
  MutationCache,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { NotFoundPage } from './features/not-found/pages/NotFoundPage'
import { initializeIntercom } from './lib/intercom'
import { getLocale, loadCatalog } from './lib/locale'
import { routeTree } from './routeTree.gen'
import {
  deserializeBigInts,
  serializeBigInts,
} from './utils/ssr-bigint-transformer'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      invalidates?: Array<QueryKey>
    }
    queryMeta: {
      dependsOn?: string[]
    }
  }
}

export async function getRouter() {
  // Create a new QueryClient instance for each request to prevent query data from leaking between server requests.
  // For more details, see: https://tanstack.com/router/latest/docs/integrations/query
  // The QueryClient is available via the router context and can also be accessed in query/mutation handlers using their context argument.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
      },
      // Round-trip bigints through the SSR boundary. Without this, the
      // server's `JSON.stringify` on the dehydrated cache either throws
      // ("Do not know how to serialize a BigInt") or, with a global
      // `BigInt.prototype.toJSON` shim, silently corrupts values above
      // `Number.MAX_SAFE_INTEGER`.
      dehydrate: { serializeData: serializeBigInts },
      hydrate: { deserializeData: deserializeBigInts },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        if (mutation.meta?.invalidates) {
          for (const invalidate of mutation.meta.invalidates) {
            queryClient.invalidateQueries({
              queryKey: invalidate,
            })
          }
        }
      },
    }),
  })

  await loadCatalog(getLocale())

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Avoid TanStack's generic "<p>Not Found</p>" when a route throws notFound.
    defaultNotFoundComponent: NotFoundPage,
    context: {
      queryClient,
    },
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  initializeIntercom()

  return router
}
