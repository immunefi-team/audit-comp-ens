import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { fallback, http, type Transport } from 'viem'
import { sepolia } from 'viem/chains'

/**
 * Single source of truth for chain / RPC / wallet config used across the apps.
 */

const DEFAULT_SEPOLIA_RPC_URL =
  'https://lb.drpc.live/sepolia/AnmpasF2C0JBqeAEzxVO8aRo7Ju0xlER8JS4QmlfqV1j'

/**
 * Public Sepolia fallback endpoints, shared by every app. dRPC intermittently
 * returns `{"error":{"message":"Internal server error","code":3}}` (HTTP 500)
 * on otherwise-valid `eth_call`s (e.g. `nonces`, `MIN_COMMITMENT_AGE`); viem's
 * `fallback()` transport transparently fails over to these so a single
 * provider blip doesn't break a registration.
 *
 * All three endpoints (each app's dRPC primary + these) are separate
 * providers, so their failure modes are uncorrelated. Exported so app CSPs
 * can derive their `connect-src` allowlist from the same source — a fallback
 * added here without a CSP entry would be silently blocked by the browser.
 */
export const SEPOLIA_FALLBACK_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  // Tenderly over 1rpc.io: 1rpc's free tier rate-limits quickly, which makes
  // it a weak failover exactly when the primary is struggling.
  'https://sepolia.gateway.tenderly.co',
] as const

/**
 * Primary-first, deduped URL list for viem's `fallback()` transport. Apps own
 * their (attributed) primary RPC URL; the public fallbacks are shared.
 */
export const orderedSepoliaRpcUrls = (primary: string): readonly string[] => [
  primary,
  ...SEPOLIA_FALLBACK_RPC_URLS.filter((url) => url !== primary),
]

function resolveRpcUrl(): string {
  try {
    if (typeof import.meta !== 'undefined') {
      const envUrl = import.meta.env?.VITE_SEPOLIA_RPC_URL
      if (!envUrl) return DEFAULT_SEPOLIA_RPC_URL
      // Relative paths (like /rpc) only work in the browser.
      // During SSR use the server-specific URL or fall back to the default.
      if (envUrl.startsWith('/') && typeof window === 'undefined') {
        return (
          import.meta.env?.VITE_SEPOLIA_RPC_URL_SERVER ||
          DEFAULT_SEPOLIA_RPC_URL
        )
      }
      return envUrl
    }
  } catch {
    // SSR or non-Vite environment
  }
  return DEFAULT_SEPOLIA_RPC_URL
}

export const SEPOLIA_RPC_URL: string = resolveRpcUrl()

/**
 * Ordered Sepolia RPC URLs: the resolved primary first, then public
 * fallbacks. Use with `sepoliaFallbackTransport` (or build your own
 * `fallback()`); the first entry stays the preferred endpoint.
 */
export const SEPOLIA_RPC_URLS: readonly string[] =
  orderedSepoliaRpcUrls(SEPOLIA_RPC_URL)

/**
 * viem `fallback()` transport over {@link SEPOLIA_RPC_URLS}. Fails over to
 * the next endpoint on transport errors (e.g. dRPC 500s), with retries on
 * each. Shared so wagmi config and standalone public clients harden the same
 * way.
 */
export const sepoliaFallbackTransport: Transport = fallback(
  SEPOLIA_RPC_URLS.map((url) => http(url, { retryCount: 2 })),
  { rank: false, retryCount: 2 },
)

export const WALLETCONNECT_PROJECT_ID = '2d42eb34b815c3019db4943096fcd58a'

export const customSepolia = {
  ...sepolia,
  rpcUrls: {
    default: { http: [...SEPOLIA_RPC_URLS] },
    public: { http: [...SEPOLIA_RPC_URLS] },
  },
}

export const sepoliaWithEns = extendChainWithEns(customSepolia)
