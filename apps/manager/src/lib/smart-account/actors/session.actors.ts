/**
 * Session actors (manager-app side) — standalone-HCA scoped SmartSessions.
 *
 * Thin wrappers around `@ens-apps/smart-account`'s session helpers. The session
 * is authorized HERE (in the app) BEFORE route selection — the single wallet
 * authorization signature — then the persisted session is rebuilt and attached
 * to the `RhinestoneSigner` passed into the registration machine.
 *
 * Flow:
 *   1. checkExistingSessionActor — reuse a valid stored session if present.
 *   2. createSessionActor — otherwise authorize one (the authorization
 *      signature) and persist it to localStorage.
 *   3. restoreSessionActor — validate a stored session before reuse.
 *
 * The stored record carries everything signer-construction needs to rebuild the
 * SDK `Session` (permissionId, resolver, nonce, validUntil, session key) so the
 * recomputed salt reproduces the same PermissionId.
 */

import {
  computeResolverAddress,
  createDestinationSession,
  DEFAULT_SESSION_VALIDITY_SECONDS,
  getSkippedStatus,
  getValidSessionForAccount,
  hasRegistrationHeadroom,
  isRhinestoneSession,
  type RhinestoneStoredSession,
  type SessionEnableError,
  SessionRestoreError,
  type SessionScope,
  saveSession,
  serializeChainDigests,
} from '@ens-apps/smart-account'
import type { RhinestoneAccount } from '@rhinestone/sdk'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import type { Address, Chain, PublicClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export type CheckSessionInput = SessionScope

export interface CheckSessionOutput {
  readonly session: RhinestoneStoredSession | null
  readonly wasSkipped: boolean
}

/**
 * Reuse a valid stored session for THIS HCA (owner + chain verified), if any.
 * An owner-keyed lookup alone can return a session bound to a different
 * account/resolver; this scopes to the account and evicts on mismatch.
 */
export function checkExistingSessionActor(
  input: CheckSessionInput,
): ResultAsync<CheckSessionOutput, never> {
  const session = getValidSessionForAccount(input)
  const wasSkipped = getSkippedStatus(input.ownerAddress)

  if (session && !isRhinestoneSession(session)) {
    return okAsync({ session: null, wasSkipped: false })
  }
  return okAsync({ session, wasSkipped })
}

export interface CreateSessionInput {
  readonly ownerAddress: Address
  readonly accountAddress: Address
  readonly chainId: number
  readonly rhinestoneAccount: RhinestoneAccount
  readonly chain: Chain
  readonly publicClient: PublicClient
  /** Whether the HCA already has code (affects the session nonce source). */
  readonly alreadyDeployed: boolean
  readonly config?: { readonly validUntil?: number }
}

export interface CreateSessionOutput {
  readonly session: RhinestoneStoredSession
}

/**
 * Authorize + persist a new session. Performs the single authorization
 * signature (destination-only, same-chain route).
 */
export function createSessionActor(
  input: CreateSessionInput,
): ResultAsync<CreateSessionOutput, SessionEnableError> {
  const sessionPrivateKey = generatePrivateKey()
  const sessionAccount = privateKeyToAccount(sessionPrivateKey)
  const resolver = computeResolverAddress({
    chainId: input.chainId,
    hca: input.accountAddress,
  })
  const validUntil = BigInt(
    input.config?.validUntil ??
      Math.floor(Date.now() / 1000) + DEFAULT_SESSION_VALIDITY_SECONDS,
  )

  return createDestinationSession({
    rhinestoneAccount: input.rhinestoneAccount,
    publicClient: input.publicClient,
    chain: input.chain,
    hca: input.accountAddress,
    resolver,
    sessionAccount,
    validUntil,
    alreadyDeployed: input.alreadyDeployed,
  }).map((result) => {
    const session: RhinestoneStoredSession = {
      id: crypto.randomUUID(),
      provider: 'rhinestone',
      sessionKeyAddress: sessionAccount.address,
      smartAccountAddress: input.accountAddress,
      ownerAddress: input.ownerAddress,
      createdAt: Date.now(),
      chainId: input.chainId,
      validUntil: Number(result.validUntil),
      sessionPrivateKey,
      permissionId: result.permissionId,
      resolver,
      hcaSessionNonce: result.hcaSessionNonce.toString(),
      authorization: result.enableData.userSignature,
      hashesAndChainIds: serializeChainDigests(
        result.enableData.hashesAndChainIds,
      ),
      sessionToEnableIndex: result.enableData.sessionToEnableIndex,
    }
    saveSession(session)
    return { session }
  })
}

export interface RestoreSessionInput {
  readonly session: RhinestoneStoredSession
}

/** Validate a stored session for reuse (no new signature). */
export function restoreSessionActor(
  input: RestoreSessionInput,
): ResultAsync<void, SessionRestoreError> {
  const { session } = input

  if (!isRhinestoneSession(session)) {
    return errAsync(
      new SessionRestoreError({
        message: 'Session type mismatch: expected Rhinestone session',
      }),
    )
  }
  if (session.validUntil && Date.now() > session.validUntil * 1000) {
    return errAsync(new SessionRestoreError({ message: 'Session has expired' }))
  }
  return okAsync(undefined)
}

export interface ResolveSessionInput {
  readonly ownerAddress: Address
  readonly accountAddress: Address
  readonly chain: Chain
  readonly rhinestoneAccount: RhinestoneAccount
  readonly publicClient: PublicClient
  readonly alreadyDeployed: boolean
}

export interface ResolvedSession {
  readonly session: RhinestoneStoredSession
}

/**
 * Reuse a valid stored session if present, else authorize one (the single
 * authorization signature).
 *
 * On resume, expiry is checked client-side here. Enable-data is NOT gated on
 * on-chain enablement: it is replayed from the stored authorization whenever a
 * batch carries the funding permit, since the validator only accepts that pair
 * on the path the proof unlocks.
 */
export function resolveSessionActor(
  input: ResolveSessionInput,
): ResultAsync<ResolvedSession, SessionEnableError> {
  const { ownerAddress, accountAddress, chain } = input

  const stored = getValidSessionForAccount({
    accountAddress,
    ownerAddress,
    chainId: chain.id,
  })
  // Mint a fresh session rather than reusing one that would expire mid-flight:
  // the reveal is session-signed and runs AFTER `MIN_COMMITMENT_AGE`, so a
  // session that only just outlives the commit strands the commitment. This
  // mirrors `needsSessionBeforeRegistration`; if the two disagreed, the gate
  // would prompt and then be handed back the same expiring session forever.
  if (
    !stored ||
    !isRhinestoneSession(stored) ||
    !hasRegistrationHeadroom(stored)
  ) {
    return createAndResolve(input)
  }

  return restoreSessionActor({ session: stored })
    .map((): ResolvedSession => ({ session: stored }))
    .orElse(() => createAndResolve(input))
}

function createAndResolve(
  input: ResolveSessionInput,
): ResultAsync<ResolvedSession, SessionEnableError> {
  return createSessionActor({
    ownerAddress: input.ownerAddress,
    accountAddress: input.accountAddress,
    chainId: input.chain.id,
    rhinestoneAccount: input.rhinestoneAccount,
    chain: input.chain,
    publicClient: input.publicClient,
    alreadyDeployed: input.alreadyDeployed,
  }).map(({ session }) => ({ session }))
}
