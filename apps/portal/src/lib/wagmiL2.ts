/**
 * Local wagmi config for L2 reverse-registrar writes (ENSv1 `setName`).
 *
 * This config is intentionally NOT mounted in any `WagmiProvider`. It exists
 * only to be passed as the `config` argument to specific wagmi hooks
 * (`useWriteContract({ config: l2WagmiConfig, ... })`, `useSwitchChain(...)`,
 * `useWaitForTransactionReceipt(...)`, etc.) on the reverse-resolution L2
 * paths. The global explorer config (`@/lib/wagmi`) remains Sepolia-only and
 * is untouched.
 *
 * Why: the explorer/indexer is bound to L1 Sepolia (Tenderly fork), but
 * setting an L2 primary name requires sending the `setName` transaction to
 * the L2 reverse registrar on the appropriate L2 (Optimism / Arbitrum / Base /
 * Linea / Scroll Sepolia). Adding those chains to the global config would
 * cause the explorer's reads to fan out beyond the L1 fork and diverge from
 * forked state.
 *
 * Per-hook `config` override is a first-class wagmi feature (`ConfigParameter`
 * on every hook). The `chainId` argument to `writeContract` is type-narrowed
 * to `config['chains'][number]['id']`, so passing this config gives compile-
 * time safety that we can only target L2s through it.
 */

import { createClient, http } from 'viem'
import {
  arbitrumSepolia,
  baseSepolia,
  lineaSepolia,
  optimismSepolia,
  scrollSepolia,
} from 'viem/chains'
import { createConfig } from 'wagmi'

export const L2_CHAINS = [
  optimismSepolia,
  arbitrumSepolia,
  baseSepolia,
  lineaSepolia,
  scrollSepolia,
] as const

export type L2ChainId = (typeof L2_CHAINS)[number]['id']

/**
 * No connectors are listed explicitly. Injected wallets (MetaMask, the Coinbase
 * extension, Rabby, Frame, …) are surfaced by EIP-6963 discovery
 * (`multiInjectedProviderDiscovery: true`) with the same connector ids as the
 * global config, and their underlying EIP-1193 provider is shared, so
 * `useEnsureL2Connection` can silently re-`connect()` by id without a second
 * approval.
 *
 * WalletConnect is intentionally omitted here, even though the global config
 * offers it: WC connections are per-config (a separate session per connector
 * instance), so re-attaching via `useEnsureL2Connection` would force a second
 * pairing rather than silently reuse the existing session. Until that flow is
 * supported, a WC-connected user hitting an L2 reverse-name write fails fast in
 * `useEnsureL2Connection` ("No matching L2 connector") instead of double-pairing.
 */
export const l2WagmiConfig = createConfig({
  // Don't pull wagmi's connected-chain state into the global app state — this
  // config is purely a vehicle for per-hook overrides on the L2 setName path.
  syncConnectedChain: false,
  ssr: false,
  multiInjectedProviderDiscovery: true,
  chains: L2_CHAINS,
  client: ({ chain }) =>
    createClient({
      chain,
      // Use each chain's default public RPC. These are only ever exercised
      // for L2 reverse-registrar reads/writes; they are not part of the
      // explorer's main data path.
      transport: http(),
    }),
})

export type L2WagmiConfig = typeof l2WagmiConfig
