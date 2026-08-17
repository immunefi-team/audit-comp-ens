import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import { LanguagesIcon } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { isSupportedLocale, loadCatalog, setLocale } from '@/lib/locale'
import { LOCALES, type SupportedLocale } from '@/lib/locales.config'

type LanguageSectionProps = {
  readonly onAction: () => void
}

const getLanguageLabel = (language: string) => {
  const normalizedLanguage = language.toLowerCase()

  return LOCALES[normalizedLanguage as SupportedLocale] ?? language
}

const allowedLanguages = new Set(Object.keys(LOCALES))

const toComparableLanguage = (language: string | null | undefined) =>
  language?.toLowerCase() ?? ''

export const LanguageSection = ({ onAction }: LanguageSectionProps) => {
  const { t, i18n } = useLingui()

  const loadLocaleMutation = useMutation({
    mutationFn: async (locale: SupportedLocale) => {
      if (!locale || !isSupportedLocale(locale)) {
        throw new Error(`Unsupported locale: ${locale}`)
      }

      await Promise.all([loadCatalog(locale), setLocale(locale)])
    },
    onSuccess: () => {
      onAction()
    },
    onError: (error) => {
      toast.error(t`Failed to switch language`, {
        description: error.message,
        id: 'switch-language-error',
      })
    },
  })

  const availableLanguages = useMemo(() => {
    return [...Object.keys(LOCALES)]
      .filter((language) =>
        allowedLanguages.has(toComparableLanguage(language)),
      )
      .sort((languageA, languageB) =>
        getLanguageLabel(languageA).localeCompare(getLanguageLabel(languageB)),
      )
  }, [])

  if (availableLanguages.length === 0) {
    return null
  }

  const resolvedLanguage = toComparableLanguage(i18n.locale)
  const selectedLanguage =
    availableLanguages.find(
      (language) => toComparableLanguage(language) === resolvedLanguage,
    ) ??
    availableLanguages.find((language) =>
      resolvedLanguage.startsWith(`${toComparableLanguage(language)}-`),
    ) ??
    availableLanguages[0]

  return (
    <div className="space-y-1">
      <label
        className="block px-3 py-1 font-medium text-foreground text-sm"
        htmlFor="header-language-selector"
      >
        <Trans>Language</Trans>
      </label>
      <div className="flex items-center gap-2 rounded border border-border px-3 py-2">
        <LanguagesIcon className="size-4 text-muted-foreground" />
        <select
          aria-label={t`Language`}
          className="w-full bg-transparent text-foreground text-sm outline-none disabled:opacity-50"
          disabled={loadLocaleMutation.isPending}
          id="header-language-selector"
          onChange={(event) =>
            loadLocaleMutation.mutate(event.target.value as SupportedLocale)
          }
          value={selectedLanguage}
        >
          {availableLanguages.map((language) => (
            <option key={language} value={language}>
              {getLanguageLabel(language)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
