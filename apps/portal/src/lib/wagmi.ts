import {
  orderedSepoliaRpcUrls,
  WALLETCONNECT_PROJECT_ID,
} from '@ens-apps/indexer/chain'
import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { walletConnect } from '@wagmi/connectors'
import { createClient, fallback, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createConfig } from 'wagmi'
import { getResolvedThemeMode } from '@/hooks/useTheme'
import { isMockWalletEnabled, mockConnector } from '@/lib/mockWallet.mock'

export { WALLETCONNECT_PROJECT_ID }

// Portal owns its Sepolia RPC URL — it must NOT reuse the RPC URL exported by
// `@ens-apps/indexer/chain`, so each app's DRPC key is attributed separately.
// This key is shipped in the browser bundle and is therefore not secret; it
// only scopes quota/usage to the portal app. An optional build-time override
// (`VITE_SEPOLIA_RPC_URL`) takes precedence when provided.
//
// This config is browser-only (`wagmiConfig` is `ssr: false`); the SSR/OG
// worker does not use it and reads its own Cloudflare secret instead (see
// `worker/clients.ts`), so no server-side RPC resolution is needed here.
const PORTAL_SEPOLIA_RPC_URL =
  'https://lb.drpc.live/sepolia/AnmpasF2C0JBqeAEzxVO8aRo7Ju0xlER8JS4QmlfqV1j'

export const SEPOLIA_RPC_URL: string =
  import.meta.env?.VITE_SEPOLIA_RPC_URL || PORTAL_SEPOLIA_RPC_URL

// Failover to the shared public endpoints (see SEPOLIA_FALLBACK_RPC_URLS in
// @ens-apps/indexer/chain for the rationale and provider choice). The portal's
// own RPC URL stays the preferred (primary) endpoint so quota/usage is still
// attributed to the portal app.
const SEPOLIA_RPC_URLS = orderedSepoliaRpcUrls(SEPOLIA_RPC_URL)

export const sepoliaFallbackTransport = fallback(
  SEPOLIA_RPC_URLS.map((url) =>
    http(url, {
      retryCount: 2,
      batch: {
        wait: 10, // Wait 10ms to collect more requests before sending batch (default is 0ms)
      },
    }),
  ),
  // rank: false keeps the declared order (primary first) instead of latency
  // ranking, which would let a fast public node steal traffic from our key.
  { rank: false, retryCount: 2 },
)

export const customSepolia = {
  ...sepolia,
  rpcUrls: {
    default: { http: [...SEPOLIA_RPC_URLS] },
    public: { http: [...SEPOLIA_RPC_URLS] },
  },
}

export const sepoliaWithEns = extendChainWithEns(customSepolia)

// Injected wallets (MetaMask, Coinbase extension, Rabby, …) are discovered via
// EIP-6963, so WalletConnect is the only explicit connector. We skip the
// Coinbase SDK connector: its Smart Wallet is mainnet-only and breaks on Sepolia.
export const wagmiConfig = createConfig({
  syncConnectedChain: false,
  ssr: false,
  multiInjectedProviderDiscovery: true,
  chains: [sepoliaWithEns],
  connectors: [
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      // Match the app's light/dark preference on load. The modal theme is fixed
      // at connector creation, so a mid-session toggle won't restyle it.
      qrModalOptions: { themeMode: getResolvedThemeMode() },
    }),
    // Test-only: auto-signing wallet for Playwright/agents. Off in production.
    ...(isMockWalletEnabled ? [mockConnector] : []),
  ],
  client: ({ chain }) =>
    createClient({
      chain,
      transport: sepoliaFallbackTransport,
    }),
})
