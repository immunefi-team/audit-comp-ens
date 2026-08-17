import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'
import { LOCALES, SOURCE_LOCALE } from './src/lib/locales.config'

export default defineConfig({
  sourceLocale: SOURCE_LOCALE,
  locales: Object.keys(LOCALES),
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: formatter({
    lineNumbers: false,
  }),
})
