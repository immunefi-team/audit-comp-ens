/**
 * Cross-provider smart-account types.
 *
 * Only provider-agnostic shapes live here. Provider-specific session
 * shapes (e.g. `RhinestoneStoredSession`) live under
 * `providers/<provider>/types.ts` and extend `BaseStoredSession`.
 */

import type { Address, Hex } from 'viem'

/**
 * Common fields for any provider-tagged stored session.
 */
export interface BaseStoredSession {
  /** Unique session identifier */
  readonly id: string
  /** Address of the session key */
  readonly sessionKeyAddress: Address
  /** Smart account address this session controls */
  readonly smartAccountAddress: Address
  /** EOA owner address that created the session */
  readonly ownerAddress: Address
  /** Unix timestamp when session was created */
  readonly createdAt: number
  /** Chain ID the session is valid for */
  readonly chainId: number
  /**
   * Expiry timestamp (unix seconds).
   *
   * Enforced BOTH on-chain (the scoped session's `validUntil` bound on the
   * standalone `HCAOwnerAndSessionValidator`) and client-side (provider helpers
   * / `isSessionExpired`) as a UX preflight that avoids submitting an Intent
   * that would revert. A stolen session key therefore stops working on-chain
   * after this timestamp, from any client.
   */
  readonly validUntil: number
  /** Session private key (hex) for signing */
  readonly sessionPrivateKey: Hex
}
