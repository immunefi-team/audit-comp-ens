import { createClientOnlyFn, createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

/**
 * Connection cookie
 *
 * Persists the connected wallet address in a cookie so server-side route
 * guards (`beforeLoad`) can make redirect decisions before React hydrates,
 * giving faster loads and SSR redirects. The cookie is written client-side
 * from the wagmi connection state (see `ConnectionCookieSync`).
 */

const CONNECTION_COOKIE_NAME = 'ens.wallet.address'
const COOKIE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30 // 30 days

const getCookieFromDocument = () => {
  const cookieValue =
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${CONNECTION_COOKIE_NAME}=`))
      ?.substring(CONNECTION_COOKIE_NAME.length + 1) ?? null

  if (!cookieValue) return null

  return decodeURIComponent(cookieValue)
}

export const getConnectionCookie = createIsomorphicFn()
  .server(() => {
    const cookie = getCookie(CONNECTION_COOKIE_NAME)
    return cookie ?? null
  })
  .client(() => {
    return getCookieFromDocument()
  })

export const setConnectionCookie = createClientOnlyFn(
  async (address: string | null) => {
    if (typeof cookieStore !== 'undefined') {
      if (address) {
        await cookieStore.set({
          name: CONNECTION_COOKIE_NAME,
          value: address,
          path: '/',
          expires: Date.now() + COOKIE_EXPIRATION_TIME,
        })
      } else {
        await cookieStore.delete({
          name: CONNECTION_COOKIE_NAME,
          path: '/',
        })
      }

      return
    }

    if (address) {
      const expires = new Date(
        Date.now() + COOKIE_EXPIRATION_TIME,
      ).toUTCString()
      const value = encodeURIComponent(address)
      // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without cookieStore support.
      document.cookie = `${CONNECTION_COOKIE_NAME}=${value}; path=/; expires=${expires}; SameSite=Lax`
    } else {
      // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without cookieStore support.
      document.cookie = `${CONNECTION_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
    }
  },
)

export const isWalletConnectedCookie = (): boolean => {
  return getConnectionCookie() !== null
}
