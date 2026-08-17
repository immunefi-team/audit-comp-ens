import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { PHProvider } from '@/lib/posthog/provider'
import { SmartAccountContextProvider } from '@/lib/smart-account'
import { WalletLifecycle, WalletProvider } from '@/lib/wallet'
import { ConnectionCookieSync } from './ConnectionCookieSync'
import { TransactionHistoryReporter } from './transaction-history/TransactionHistoryReporter'

export const RootProviders = ({ children }: { children: React.ReactNode }) => (
  // WalletProvider owns wagmi + the vendor; everything inside reads the wallet
  // through the seam. (QueryClientProvider comes from the router's SSR-query
  // integration — see router.tsx.)
  <I18nProvider i18n={i18n}>
    <WalletProvider>
      <ConnectionCookieSync />
      <WalletLifecycle />
      <TransactionHistoryReporter />
      <PHProvider>
        <SmartAccountContextProvider>{children}</SmartAccountContextProvider>
      </PHProvider>
    </WalletProvider>
  </I18nProvider>
)
