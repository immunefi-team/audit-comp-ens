import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import {
  render as baseRender,
  type RenderOptions,
} from '@testing-library/react'
import { createConfig, mock, WagmiProvider } from 'wagmi'
import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { beforeEach } from 'vitest'

import { hashFn } from 'wagmi/query'

const mainnetWithEns = extendChainWithEns(mainnet)

const client = createClient({
  transport: http('http://mock.local'),
  chain: mainnetWithEns,
})

const privateKeyAccount = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

const wagmiConfig = {
  ...createConfig({
    connectors: [
      mock({
        accounts: [privateKeyAccount.address],
        features: {},
      }),
    ],
    chains: [mainnetWithEns],
    client: () => client,
  }),
  _isEns: true,
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      retry: false,
      queryKeyHashFn: hashFn,
    },
  },
})

i18n.loadAndActivate({ locale: 'en', messages: {} })

beforeEach(() => queryClient.clear())

interface AllTheProvidersProps {
  children: React.ReactNode
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => (
  // Just wagmi (mock connector) — the wallet hooks read wagmi, which
  // this provides; no wallet-stack provider needed for the hooks under test.
  <I18nProvider i18n={i18n}>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  </I18nProvider>
)

export const render = (ui: React.ReactNode, options?: RenderOptions) =>
  baseRender(ui, { wrapper: AllTheProviders, ...options })
