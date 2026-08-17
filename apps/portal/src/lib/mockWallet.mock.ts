import { mock } from '@wagmi/connectors'
import type { Address } from 'viem'

// Test-only mock wallet — mirrors the setup in `ens-app-v3`.
//
// When `VITE_USE_MOCK_WALLET === 'true'` the app registers wagmi's `mock`
// connector and auto-connects it on load (see `MockWalletAutoConnect`), so an
// automated browser (Playwright / agents) never has to click through the
// connect modal or a signing prompt. The `mock` connector forwards
// `eth_sendTransaction`/`eth_sign*` as raw JSON-RPC to the connected chain's
// default RPC URL, so point `VITE_SEPOLIA_RPC_URL` at a local node
// (Anvil/Hardhat) whose account is unlocked. NEVER enable in production.

// First account of the well-known `test test … junk` mnemonic that local dev
// nodes unlock by default. Overridable via `VITE_MOCK_ACCOUNT`.
export const DEFAULT_MOCK_ACCOUNT: Address =
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/** Master toggle — build-time flag; never set in production. */
export const isMockWalletEnabled =
  import.meta.env?.VITE_USE_MOCK_WALLET === 'true'

/** Connector id — matches wagmi's built-in `mock` connector id. */
export const MOCK_CONNECTOR_ID = 'mock'

const mockAccount =
  (import.meta.env?.VITE_MOCK_ACCOUNT as Address) || DEFAULT_MOCK_ACCOUNT

// `reconnect: true` lets wagmi treat the connector as authorized once it has
// connected (see `MockWalletAutoConnect` for why that isn't enough on reload).
export const mockConnector = /*#__PURE__*/ mock({
  accounts: [mockAccount],
  features: { reconnect: true },
})
