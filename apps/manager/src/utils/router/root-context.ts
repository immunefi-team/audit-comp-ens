import type { RegisteredRouter } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'

/**
 * Returns the router on client, undefined on server
 */
export const getRouterInstance = createIsomorphicFn().client(
  (): RegisteredRouter | undefined => window.__TSR_ROUTER__,
)

export const getRootContext = () => {
  const router = getRouterInstance()
  if (!router) {
    return undefined
  }

  return router.options.context
}

export const getQueryClient = () => getRootContext()?.queryClient
