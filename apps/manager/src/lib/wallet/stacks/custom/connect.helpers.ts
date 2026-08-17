import type { Connector } from 'wagmi'

// Connector ids for the two non-injected connectors configured in
// `@/lib/wagmi`. Injected wallets (MetaMask, Rabby, …) arrive via EIP-6963 with
// their rdns as the connector id.
export const COINBASE_ID = 'coinbaseWalletSDK'
export const WALLETCONNECT_ID = 'walletConnect'
export const METAMASK_RDNS = 'io.metamask'
export const METAMASK_DOWNLOAD_URL = 'https://metamask.io/download/'

// Keep the wallet's current chain if the app supports it, else the app's first
// chain — so wallets that default to mainnet still land on the right chain.
export const resolveConnectChainId = (
  walletChainId: number,
  // Non-empty tuple, matching wagmi's `config.chains` — encodes the "at least
  // one chain" invariant the fallback below relies on.
  chains: readonly [{ readonly id: number }, ...{ readonly id: number }[]],
): number =>
  chains.some((c) => c.id === walletChainId) ? walletChainId : chains[0].id

export const isMetaMask = (connector: Connector) =>
  connector.id === METAMASK_RDNS || connector.name === 'MetaMask'

export const isCoinbase = (connector: Connector) =>
  connector.id === COINBASE_ID ||
  connector.id === 'com.coinbase.wallet' ||
  connector.name.toLowerCase().includes('coinbase')

// True when the user dismissed/rejected the wallet prompt (viem
// `UserRejectedRequestError`, EIP-1193 code 4001) rather than an actual failure.
export const isConnectionCancelled = (error: unknown): boolean => {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  return (
    name === 'UserRejectedRequestError' ||
    /user rejected|user denied|rejected the request|cancell?ed/i.test(message)
  )
}

// Map raw wagmi/viem connect errors onto user-facing messages so we never leak
// technical detail into the UI.
export const normalizeConnectError = (error: unknown): string =>
  isConnectionCancelled(error)
    ? 'Connection cancelled'
    : 'Unable to connect wallet'
