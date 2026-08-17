import { i18n, type Messages } from '@lingui/core'
import { createClientOnlyFn, createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import {
  LOCALES,
  SOURCE_LOCALE,
  type SupportedLocale,
} from '@/lib/locales.config'

export const isSupportedLocale = (
  locale: string,
): locale is SupportedLocale => {
  return Object.keys(LOCALES).includes(locale)
}

export const getSupportedLocales = () => {
  return Object.keys(LOCALES)
}

const STORAGE_KEY = 'locale'

const getLocaleFromCookie = createIsomorphicFn()
  .client(() => {
    const cookieValue =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${STORAGE_KEY}=`))
        ?.substring(STORAGE_KEY.length + 1) ?? null

    if (!cookieValue) return null

    return decodeURIComponent(cookieValue)
  })
  .server(() => {
    const cookie = getCookie(STORAGE_KEY)
    return cookie ?? null
  })

export const getLocale = () => {
  const locale = getLocaleFromCookie()

  if (!locale || !isSupportedLocale(locale)) {
    return SOURCE_LOCALE
  }

  return locale
}

export const setLocale = createClientOnlyFn(async (locale: string | null) => {
  if (locale && !isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`)
  }

  if (typeof cookieStore !== 'undefined') {
    if (locale) {
      await cookieStore.set({
        name: STORAGE_KEY,
        value: locale,
        path: '/',
      })
    } else {
      await cookieStore.delete({
        name: STORAGE_KEY,
        path: '/',
      })
    }

    return
  }

  if (locale) {
    const value = encodeURIComponent(locale)
    // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without cookieStore support.
    document.cookie = `${STORAGE_KEY}=${value}; path=/; SameSite=Lax`
  } else {
    // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without cookieStore support.
    document.cookie = `${STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`
  }
})

export async function loadCatalog(locale: SupportedLocale) {
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`)
  }

  const { messages } = await (import(
    `@/locales/${locale}/messages.po`
  ) as Promise<{ messages: Messages }>)
  i18n.loadAndActivate({ locale, messages })
}
