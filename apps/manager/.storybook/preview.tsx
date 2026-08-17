import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { definePreview } from '@storybook/tanstack-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { loadCatalog } from '@/lib/locale'
import '@/styles/index.css'

await loadCatalog('en')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})

export default definePreview({
  beforeEach: () => {
    // 👇 Clear the cache between stories so each story starts fresh
    queryClient.clear()
  },
  parameters: {
    tanstack: {
      router: {
        // 👇 Make queryClient available to route loaders via ctx.context.queryClient
        context: { queryClient },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      // 👇 Provide the QueryClient to all stories
      <QueryClientProvider client={queryClient}>
        <I18nProvider i18n={i18n}>
          <Story />
        </I18nProvider>
      </QueryClientProvider>
    ),
  ],
})
