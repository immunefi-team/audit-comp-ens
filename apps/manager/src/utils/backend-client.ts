import { createStore } from '@xstate/store-react'
import type { AppRouter } from 'api-worker/hc'
import { hc } from 'hono/client'
import posthog from 'posthog-js'
import { persist } from './xstate-store'

const BACKEND_AUTH_STORAGE_KEY = '@manager-v4/backend_auth'

type BackendAuthContext = {
  authKey: string | undefined
  address: string | undefined
  modalDismissed: boolean
  apiBaseUrlOverride: string | undefined
}

type BackendAuthEvents = {
  signIn: { authKey: string; address: string }
  signOut: Record<string, never>
  dismissModal: Record<string, never>
  resetModal: Record<string, never>
  setApiBaseUrlOverride: { url: string }
  clearApiBaseUrlOverride: Record<string, never>
}

export const backendAuthStore = createStore<
  BackendAuthContext,
  BackendAuthEvents,
  never
>({
  context: {
    authKey: undefined,
    address: undefined,
    modalDismissed: false,
    apiBaseUrlOverride: undefined,
  },
  on: {
    signIn: (context, event: { authKey: string; address: string }) => ({
      ...context,
      authKey: event.authKey,
      address: event.address,
      modalDismissed: false,
    }),
    signOut: (context) => ({
      ...context,
      authKey: undefined,
      address: undefined,
      modalDismissed: false,
    }),
    dismissModal: (context) => ({
      ...context,
      modalDismissed: true,
    }),
    resetModal: (context) => ({
      ...context,
      modalDismissed: false,
    }),
    setApiBaseUrlOverride: (context, event: { url: string }) => ({
      ...context,
      apiBaseUrlOverride: event.url,
    }),
    clearApiBaseUrlOverride: (context) => ({
      ...context,
      apiBaseUrlOverride: undefined,
    }),
  },
}).with(
  persist({
    name: BACKEND_AUTH_STORAGE_KEY,
  }),
)

export const isBackendAuthed = backendAuthStore.select(
  (state) => state.authKey !== undefined,
)

export const DEFAULT_BACKEND_API_URL = import.meta.env.VITE_API_URL ?? '/api'

export const ALLOWED_SIWE_DOMAINS = ['app.ens.dev', 'app.ens.domains'] as const
export type AllowedSiweDomain = (typeof ALLOWED_SIWE_DOMAINS)[number]
export const DEFAULT_SIWE_DOMAIN: AllowedSiweDomain = 'app.ens.dev'

export const getSiweDomain = (): AllowedSiweDomain => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if ((ALLOWED_SIWE_DOMAINS as readonly string[]).includes(host)) {
      return host as AllowedSiweDomain
    }
  }
  return DEFAULT_SIWE_DOMAIN
}

export const getSiweUri = (): string => `https://${getSiweDomain()}`

export const getBackendApiBaseUrl = () =>
  backendAuthStore.get().context.apiBaseUrlOverride ?? DEFAULT_BACKEND_API_URL

const resolveBaseUrl = (baseUrl: string) => {
  if (baseUrl.startsWith('/')) {
    const origin =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    return new URL(baseUrl, origin)
  }

  return new URL(baseUrl)
}

const resolveBackendRequestUrl = (input: RequestInfo | URL) => {
  const inputUrl =
    input instanceof URL
      ? input.toString()
      : typeof Request !== 'undefined' && input instanceof Request
        ? input.url
        : input.toString()
  const nextBaseUrl = resolveBaseUrl(getBackendApiBaseUrl())
  const parsedInputUrl = new URL(inputUrl, nextBaseUrl)
  const rebasedUrl = new URL(nextBaseUrl.toString())

  rebasedUrl.pathname = parsedInputUrl.pathname
  rebasedUrl.search = parsedInputUrl.search
  rebasedUrl.hash = parsedInputUrl.hash

  return rebasedUrl.toString()
}

const authFetch: typeof fetch = async (input, init) => {
  const resolvedUrl = resolveBackendRequestUrl(input)
  const response =
    typeof Request !== 'undefined' && input instanceof Request
      ? await fetch(new Request(resolvedUrl, input), init)
      : await fetch(resolvedUrl, init)

  if (response.status === 401) {
    if (isBackendAuthed.get()) {
      backendAuthStore.trigger.signOut()
    }
  }

  return response
}

export const backendClient = hc<AppRouter>(DEFAULT_BACKEND_API_URL, {
  headers: () => {
    const auth = backendAuthStore.get().context.authKey
    const posthogId = posthog.get_distinct_id()

    if (!auth) {
      return {
        'X-PostHog-Distinct-ID': posthogId,
      } as Record<string, string>
    }

    return {
      Authorization: `Bearer ${auth}`,
      'X-PostHog-Distinct-ID': posthogId,
    }
  },

  fetch: authFetch,
})
