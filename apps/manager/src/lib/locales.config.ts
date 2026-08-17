export const LOCALES = {
  en: 'English',
  sv: 'Swedish',
} as const

export type SupportedLocale = keyof typeof LOCALES

export const SOURCE_LOCALE = 'en' as const satisfies SupportedLocale
