/**
 * Shared decision for the registration session gate.
 *
 * NOTE: "session" here is NOT ERC-7579 SmartSessions (the HCA does not install
 * that module). It is a time-boxed extra OWNER added to the HCA's
 * OwnableValidator — an ephemeral key that can sign Intents prompt-free until it
 * expires.
 *
 * Both registration entry points (register-v2 via `useSmartSessionGate` and the
 * v1 `RegistrationPage`) use this to decide whether to prompt the user to enable
 * a session before starting registration.
 *
 * Rule: only the HCA (rhinestone) path uses sessions. If a session is already
 * active, proceed; otherwise the user must enable one (the single ENABLE
 * signature). The EOA-only path (no rhinestone signer) never needs a session.
 */

import { hasRegistrationHeadroom } from '@ens-apps/smart-account'
import { type Address, isAddressEqual } from 'viem'
import type { SmartAccountContextValue } from './SmartAccountContext'

export function needsSessionBeforeRegistration(
  account: Readonly<
    Pick<
      SmartAccountContextValue,
      'signer' | 'hasActiveSession' | 'activeStoredSession'
    >
  >,
): boolean {
  if (account.signer?.type !== 'rhinestone') return false
  if (!account.hasActiveSession) return true
  // A session that is alive NOW but dies during the commitment cooldown would
  // strand a paid-for commitment with an unsignable reveal. Prompt for a fresh
  // one up front instead. `resolveSessionActor` applies the same headroom, so
  // the ENABLE actually mints a new session rather than handing back this one.
  return account.activeStoredSession
    ? !hasRegistrationHeadroom(account.activeStoredSession)
    : false
}

/**
 * Owner-equality guard for the Rhinestone session path (WEB-287 / EXP-RHN-003).
 *
 * The HCA owner address has two independent sources: the smart-account state
 * machine's context (`snapshot.context.ownerAddress`, set at HCA init / enable
 * time) and wagmi's connected wallet (`eoaAddress`). A time-boxed session enables
 * an ephemeral key as an owner of the HCA for a SPECIFIC owner EOA; reusing it
 * against a different connected EOA (shared device, cross-EOA reconnect, or a
 * transitional state-machine snapshot where the machine has reset to
 * `disconnected` — `ownerAddress=null` — while wagmi already reports a new
 * address) would either register a name to the wrong owner or attach a session
 * the on-chain OwnableValidator rejects.
 *
 * This returns the verified owner ONLY when both sources are present and agree
 * (checksum-insensitive, via viem's `isAddressEqual`). It returns `null` —
 * never a fallback — when the machine's owner is missing or diverges, so
 * callers fail fast instead of papering over the race with `?? eoaAddress`.
 *
 * `isAddressEqual` throws on a malformed address; we treat that as a
 * divergence (return `null`) rather than crashing the render that builds the
 * signer — a non-address owner is, definitionally, not the connected EOA.
 */
export function resolveVerifiedOwner(
  machineOwner: Address | null | undefined,
  eoaAddress: Address | null | undefined,
): Address | null {
  if (!machineOwner || !eoaAddress) return null
  try {
    return isAddressEqual(machineOwner, eoaAddress) ? machineOwner : null
  } catch {
    return null
  }
}

/**
 * Dedupe key for the session-hydration effect.
 *
 * MUST include BOTH the owner and the HCA `accountAddress`. On a page reload
 * mid-registration the owner address (from the connected wallet) resolves a
 * render BEFORE the HCA `accountAddress` does (the HCA must be computed/deployed
 * first). If the key were owner-only, the effect would run once while
 * `accountAddress` was still null — skipping the scoped localStorage lookup —
 * and then short-circuit on the re-run once the account arrived, leaving the
 * session un-hydrated (`hasActiveSession=false`) and re-prompting ENABLE on
 * every reload. Keying on owner+account makes the effect re-run (and actually
 * perform the lookup) once both are known.
 *
 * Returns `null` when there is no owner (nothing to hydrate).
 */
export function sessionHydrationKey(
  ownerAddress: Address | null | undefined,
  accountAddress: Address | null | undefined,
): string | null {
  const owner = ownerAddress?.toLowerCase() ?? null
  if (!owner) return null
  const account = accountAddress?.toLowerCase() ?? null
  return account ? `${owner}:${account}` : owner
}
