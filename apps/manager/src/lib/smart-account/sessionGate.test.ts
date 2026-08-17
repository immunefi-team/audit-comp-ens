import { SESSION_REGISTRATION_HEADROOM_SECONDS } from '@ens-apps/smart-account'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  needsSessionBeforeRegistration,
  resolveVerifiedOwner,
  sessionHydrationKey,
} from './sessionGate'

type GateInput = Parameters<typeof needsSessionBeforeRegistration>[0]

/** A stored session expiring `seconds` from now. */
const expiringIn = (seconds: number) =>
  ({
    validUntil: Math.floor(Date.now() / 1000) + seconds,
  }) as GateInput['activeStoredSession']

const rhinestone = (
  hasActiveSession: boolean,
  activeStoredSession: GateInput['activeStoredSession'] = null,
): GateInput =>
  ({
    signer: { type: 'rhinestone' },
    hasActiveSession,
    activeStoredSession,
  }) as GateInput

describe('needsSessionBeforeRegistration', () => {
  it('requires enabling a session on the HCA path when none is active', () => {
    expect(needsSessionBeforeRegistration(rhinestone(false))).toBe(true)
  })

  it('does NOT require enabling when a session is already active (reuse)', () => {
    expect(
      needsSessionBeforeRegistration(rhinestone(true, expiringIn(86_400))),
    ).toBe(false)
  })

  it('requires a fresh session when the active one dies mid-registration', () => {
    // Alive now, but gone before commit → MIN_COMMITMENT_AGE → reveal finishes.
    // Reusing it would strand a paid-for commitment with an unsignable reveal.
    expect(
      needsSessionBeforeRegistration(rhinestone(true, expiringIn(120))),
    ).toBe(true)
  })

  it('accepts a session with exactly the required headroom', () => {
    expect(
      needsSessionBeforeRegistration(
        rhinestone(true, expiringIn(SESSION_REGISTRATION_HEADROOM_SECONDS + 5)),
      ),
    ).toBe(false)
  })

  it('does NOT require a session on the EOA path', () => {
    expect(
      needsSessionBeforeRegistration({
        signer: { type: 'eoa' } as GateInput['signer'],
        hasActiveSession: false,
        activeStoredSession: null,
      }),
    ).toBe(false)
  })

  it('does NOT require a session when there is no signer yet', () => {
    expect(
      needsSessionBeforeRegistration({
        signer: null,
        hasActiveSession: false,
        activeStoredSession: null,
      }),
    ).toBe(false)
  })
})

describe('sessionHydrationKey', () => {
  const OWNER = '0xOWNER000000000000000000000000000000beef' as Address
  const HCA = '0xHCA0000000000000000000000000000000000cafe' as Address

  it('returns null when there is no owner', () => {
    expect(sessionHydrationKey(null, null)).toBeNull()
    expect(sessionHydrationKey(undefined, HCA)).toBeNull()
  })

  it('is owner-only while the HCA address is not yet known', () => {
    expect(sessionHydrationKey(OWNER, null)).toBe(OWNER.toLowerCase())
  })

  // The core regression: the key MUST change once the HCA address arrives, so
  // the hydration effect re-runs and performs the (account-scoped) localStorage
  // lookup. An owner-only key would be identical before/after the account
  // resolves → effect short-circuits → session never hydrated → ENABLE
  // re-prompts on every reload.
  it('CHANGES once the HCA address arrives (owner resolves first on reload)', () => {
    const ownerOnly = sessionHydrationKey(OWNER, null)
    const withAccount = sessionHydrationKey(OWNER, HCA)
    expect(withAccount).not.toBe(ownerOnly)
    expect(withAccount).toBe(`${OWNER.toLowerCase()}:${HCA.toLowerCase()}`)
  })

  it('is stable for the same owner+account (no redundant re-runs)', () => {
    expect(sessionHydrationKey(OWNER, HCA)).toBe(
      sessionHydrationKey(OWNER, HCA),
    )
  })

  it('changes when the account changes (different HCA → re-scope lookup)', () => {
    const other = '0xHCA000000000000000000000000000000000beef' as Address
    expect(sessionHydrationKey(OWNER, HCA)).not.toBe(
      sessionHydrationKey(OWNER, other),
    )
  })
})

// WEB-287 / EXP-RHN-003: the verified-owner guard for the session/signer path.
describe('resolveVerifiedOwner', () => {
  // Same address, two valid casings: EIP-55-checksummed and all-lowercase.
  // `resolveVerifiedOwner` compares with viem's `isAddressEqual`, which is
  // checksum-insensitive but validates the input is a real address.
  const A = '0xAAaA000000000000000000000000000000000001' as Address
  const A_LOWER = '0xaaaa000000000000000000000000000000000001' as Address
  const B = '0xBBbb000000000000000000000000000000000002' as Address

  it('returns the owner when machine and wagmi agree', () => {
    expect(resolveVerifiedOwner(A, A)).toBe(A)
  })

  it('matches regardless of casing (checksummed vs lowercase)', () => {
    expect(resolveVerifiedOwner(A, A_LOWER)).toBe(A)
    expect(resolveVerifiedOwner(A_LOWER, A)).toBe(A_LOWER)
  })

  // The core race: machine still holds owner A while wagmi reports owner B
  // (shared device / cross-EOA reconnect). MUST NOT resolve — no fallback.
  it('returns null when machine and wagmi DIVERGE (never falls back)', () => {
    expect(resolveVerifiedOwner(A, B)).toBeNull()
  })

  it('returns null when the machine owner is missing (no eoa fallback)', () => {
    expect(resolveVerifiedOwner(null, A)).toBeNull()
    expect(resolveVerifiedOwner(undefined, A)).toBeNull()
  })

  it('returns null when the connected EOA is missing', () => {
    expect(resolveVerifiedOwner(A, null)).toBeNull()
    expect(resolveVerifiedOwner(A, undefined)).toBeNull()
  })

  it('returns null when both are missing', () => {
    expect(resolveVerifiedOwner(null, null)).toBeNull()
  })

  // `isAddressEqual` throws on a malformed address; the resolver must treat
  // that as a divergence (null) rather than crash the render that builds the
  // signer. A non-address owner is, by definition, not the connected EOA.
  it('returns null (does not throw) on a malformed owner', () => {
    const garbage = '0xnotanaddress' as Address
    expect(resolveVerifiedOwner(garbage, A)).toBeNull()
    expect(resolveVerifiedOwner(A, garbage)).toBeNull()
  })
})
