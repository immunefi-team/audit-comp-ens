import {
  orderedSepoliaRpcUrls,
  WALLETCONNECT_PROJECT_ID,
} from '@ens-apps/indexer/chain'
import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { createIsomorphicFn } from '@tanstack/react-start'
import { createPublicClient, fallback, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createConfig } from 'wagmi'
import { walletConnect } from 'wagmi/connectors'
import { isMockWalletEnabled, mockConnector } from '@/lib/mockWallet.mock'

// Manager owns its Sepolia RPC URL — it must NOT reuse the RPC URL exported by
// `@ens-apps/indexer/chain`, so each app's DRPC key is attributed separately.
// This key is shipped in the browser bundle and is therefore not secret; it
// only scopes quota/usage to the manager app. An optional build-time override
// (`VITE_SEPOLIA_RPC_URL`) takes precedence when provided.
const MANAGER_SEPOLIA_RPC_URL =
  'https://lb.drpc.live/sepolia/AnmpasF2C0JBqeAEzxVO8aTDnH6wviUR8JD3QmlfqV1j'

const resolveRpcUrl = createIsomorphicFn()
  .client(() => {
    // In the browser any configured URL works, including relative paths like
    // `/rpc` that proxy through the app's own origin.
    return import.meta.env?.VITE_SEPOLIA_RPC_URL || MANAGER_SEPOLIA_RPC_URL
  })
  .server(() => {
    const envUrl = import.meta.env?.VITE_SEPOLIA_RPC_URL
    if (!envUrl) return MANAGER_SEPOLIA_RPC_URL
    // Relative paths (like /rpc) only work in the browser. During SSR use the
    // server-specific URL or fall back to the manager default.
    if (envUrl.startsWith('/')) {
      return (
        import.meta.env?.VITE_SEPOLIA_RPC_URL_SERVER || MANAGER_SEPOLIA_RPC_URL
      )
    }
    return envUrl
  })

// `createIsomorphicFn` is a no-op stub until the TanStack Start Vite plugin
// transforms it. In environments where that transform doesn't run (e.g. the
// vitest config, which doesn't include the Start plugin) the call returns
// `undefined`, so fall back to the default to keep `SEPOLIA_RPC_URL` a string.
export const SEPOLIA_RPC_URL: string =
  resolveRpcUrl() || MANAGER_SEPOLIA_RPC_URL

// Failover to the shared public endpoints (see SEPOLIA_FALLBACK_RPC_URLS in
// @ens-apps/indexer/chain for the rationale and provider choice). The
// manager's own RPC URL stays the preferred (primary) endpoint so quota/usage
// is still attributed to the manager app.
const SEPOLIA_RPC_URLS = orderedSepoliaRpcUrls(SEPOLIA_RPC_URL)

export const sepoliaFallbackTransport = fallback(
  SEPOLIA_RPC_URLS.map((url) => http(url, { retryCount: 2 })),
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

export const publicClient = createPublicClient({
  chain: sepoliaWithEns,
  transport: sepoliaFallbackTransport,
  batch: {
    multicall: true,
  },
})

export const wagmiConfig = createConfig({
  syncConnectedChain: false,
  ssr: true,
  multiInjectedProviderDiscovery: true,
  chains: [sepoliaWithEns],
  transports: {
    [sepoliaWithEns.id]: sepoliaFallbackTransport,
  },
  // Injected wallets (MetaMask, Rabby, Frame, …) are discovered via EIP-6963
  // (multiInjectedProviderDiscovery above), so WalletConnect is the only
  // explicit connector — same setup as the portal app.
  connectors: [
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      // The QR modal follows the OS theme by default; the manager app is
      // light-only, so pin it.
      qrModalOptions: { themeMode: 'light' },
    }),
    // Test-only: auto-signing wallet for Playwright/agents. Off in production.
    ...(isMockWalletEnabled ? [mockConnector] : []),
  ],
})

export type ClientType = ReturnType<typeof wagmiConfig.getClient>
export type ChainType = ClientType['chain']
