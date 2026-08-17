/**
 * Standalone-HCA session construction (scoped SmartSessions).
 *
 * A "session" here is a scoped ERC-7579 SmartSession on the standalone
 * `HCAOwnerAndSessionValidator` — NOT the old ephemeral-owner model. The wallet
 * signs ONE multi-chain authorization up front (before route selection); the
 * session is then enabled lazily inside the first HCA action via
 * `enableSessionWithRefund(...)`. No separate ENABLE transaction.
 *
 * First pass is SAME-CHAIN ONLY: we build just the destination (Sepolia) HCA
 * session and its enable-data. The source-session salt encoder is included as a
 * pure function (`computeSourceSessionSalt`) + tests so cross-chain can be
 * added later without reshaping this module — re-authorization is required to
 * add a source anyway.
 *
 * Field orders in the salt encoders are EXACT and load-bearing (they must match
 * the on-chain validator + the reference `liveHcaRhinestoneRegistration`
 * script). Do not reorder.
 */

import type {
  ChainSessionConfig,
  RhinestoneAccount,
  Session,
} from '@rhinestone/sdk'
import { getPermissionId } from '@rhinestone/sdk/smart-sessions'
import { fromPromise, type ResultAsync } from 'neverthrow'
import {
  type Account,
  type Address,
  type Chain,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  type PublicClient,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SessionEnableError } from '../../errors'
import {
  getDestinationContracts,
  MAX_REFUND_AMOUNT,
  MAX_REFUND_EXCHANGE_RATE,
  MAX_REFUND_GAS_OVERHEAD,
} from './manifest'

const standaloneHcaAbi = parseAbi([
  'function ownerAndSessionNonce() view returns (address owner, uint96 sessionNonce)',
])

/**
 * Per-session enable-data (the value passed to the Rhinestone signer). NOTE:
 * this is NOT the raw authorization bytes — each entry references the session
 * by index into the signed session set. Only the destination entry carries
 * the HCA nonce.
 *
 * Extends the SDK shape with the standalone-HCA nonce added by the ENS patch.
 * The published SDK 1.8 declarations do not include this runtime field yet.
 */
export type SessionEnableData = NonNullable<
  ChainSessionConfig['enableData']
> & {
  readonly hcaSessionNonce: bigint
}

/** Standalone sessions bind the permission to one HCA address. */
export type StandaloneHcaSession = Session & {
  readonly account: Address
  readonly salt: Hex
}

/** One chain digest entry from `SessionDetails.hashesAndChainIds`. */
export type ChainDigest = SessionEnableData['hashesAndChainIds'][number]

export interface DestinationSessionParams {
  /** Live SDK account (used for getSessionDetails / signEnableSession). */
  readonly rhinestoneAccount: RhinestoneAccount
  /** Public client for reading `ownerAndSessionNonce()` on existing HCAs. */
  readonly publicClient: PublicClient
  readonly chain: Chain
  readonly hca: Address
  /** The resolver this session is bound to (a PermissionedResolver proxy). */
  readonly resolver: Address
  /** Ephemeral session key (single ECDSA session owner). */
  readonly sessionAccount: Account
  /** Session expiry (unix seconds). */
  readonly validUntil: bigint
  /** Whether the HCA already has code (determines the nonce source). */
  readonly alreadyDeployed: boolean
}

export interface DestinationSessionResult {
  readonly session: StandaloneHcaSession
  readonly permissionId: Hex
  readonly enableData: SessionEnableData
  readonly hcaSessionNonce: bigint
  readonly validUntil: bigint
}

/**
 * Compute the destination (HCA-side) session salt. EXACT field order:
 * uint96 nonce, uint48 validUntil, address resolver, address refundToken,
 * uint96 maxRefundExchangeRate, uint48 maxRefundGasOverhead,
 * uint96 maxRefundAmount.
 */
export function computeDestinationSessionSalt(params: {
  readonly hcaSessionNonce: bigint
  readonly validUntil: bigint
  readonly resolver: Address
  readonly refundToken: Address
  readonly maxRefundExchangeRate?: bigint
  readonly maxRefundGasOverhead?: bigint
  readonly maxRefundAmount?: bigint
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint96' },
        { type: 'uint48' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint96' },
        { type: 'uint48' },
        { type: 'uint96' },
      ],
      [
        params.hcaSessionNonce,
        Number(params.validUntil),
        params.resolver,
        params.refundToken,
        params.maxRefundExchangeRate ?? MAX_REFUND_EXCHANGE_RATE,
        Number(params.maxRefundGasOverhead ?? MAX_REFUND_GAS_OVERHEAD),
        params.maxRefundAmount ?? MAX_REFUND_AMOUNT,
      ],
    ),
  )
}

/**
 * Compute the source (funding Nexus-side) session salt. EXACT field order:
 * address wallet, uint48 validUntil, address sourceToken, address hca,
 * address destinationToken, uint64 destinationChainId, uint96 maxSourceAmount,
 * uint96 maxDestinationAmount.
 *
 * NOTE: `acrossArbiter` is NOT part of the salt (updated handoff doc). The
 * source validator reads the active Across adapter from the Rhinestone Router
 * at claim time, so a compatible adapter change does not affect the source
 * permission ID. Kept as a pure function for the deferred cross-chain path.
 */
export function computeSourceSessionSalt(params: {
  readonly wallet: Address
  readonly validUntil: bigint
  readonly sourceToken: Address
  readonly hca: Address
  readonly destinationToken: Address
  readonly destinationChainId: bigint
  readonly maxSourceAmount: bigint
  readonly maxDestinationAmount: bigint
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint48' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint64' },
        { type: 'uint96' },
        { type: 'uint96' },
      ],
      [
        params.wallet,
        Number(params.validUntil),
        params.sourceToken,
        params.hca,
        params.destinationToken,
        params.destinationChainId,
        params.maxSourceAmount,
        params.maxDestinationAmount,
      ],
    ),
  )
}

/**
 * Read the HCA session nonce. Undeployed HCAs use nonce 0; deployed HCAs must
 * read `ownerAndSessionNonce()` before a new authorization.
 */
async function readSessionNonce(params: {
  publicClient: PublicClient
  hca: Address
  alreadyDeployed: boolean
}): Promise<bigint> {
  if (!params.alreadyDeployed) return 0n
  const [, nonce] = await params.publicClient.readContract({
    address: params.hca,
    abi: standaloneHcaAbi,
    functionName: 'ownerAndSessionNonce',
  })
  return nonce
}

/**
 * Build + sign the destination HCA session authorization (same-chain route).
 *
 * This is the FIRST wallet prompt. The returned `enableData` is passed to the
 * Rhinestone signer for the first HCA action; the session is enabled lazily
 * there (no separate ENABLE tx).
 */
export function createDestinationSession(
  params: DestinationSessionParams,
): ResultAsync<DestinationSessionResult, SessionEnableError> {
  return fromPromise(
    (async () => {
      const c = getDestinationContracts(params.chain.id)
      const hcaSessionNonce = await readSessionNonce({
        publicClient: params.publicClient,
        hca: params.hca,
        alreadyDeployed: params.alreadyDeployed,
      })

      const salt = computeDestinationSessionSalt({
        hcaSessionNonce,
        validUntil: params.validUntil,
        resolver: params.resolver,
        refundToken: c.usdc,
      })

      const session: StandaloneHcaSession = {
        chain: params.chain,
        account: params.hca,
        salt,
        owners: { type: 'ecdsa', accounts: [params.sessionAccount] },
      }

      const permissionId = getPermissionId(session)

      // ONE multi-chain authorization signature (destination only for now).
      const details =
        await params.rhinestoneAccount.experimental_getSessionDetails([session])
      const userSignature =
        await params.rhinestoneAccount.experimental_signEnableSession(details)

      const enableData: SessionEnableData = {
        userSignature,
        hashesAndChainIds: details.hashesAndChainIds,
        sessionToEnableIndex: 0,
        hcaSessionNonce,
      }

      return {
        session,
        permissionId,
        enableData,
        hcaSessionNonce,
        validUntil: params.validUntil,
      }
    })(),
    (error: unknown) =>
      new SessionEnableError({
        message: 'Failed to create destination HCA session authorization',
        cause: error,
      }),
  )
}

/**
 * Build the `enableSessionWithRefund(...)` validator call for the first HCA
 * action. Arg order is EXACT: permissionId, sessionKey, validUntil, resolver,
 * refundToken, maxRefundExchangeRate, maxRefundGasOverhead, maxRefundAmount.
 */
const enableSessionWithRefundAbi = parseAbi([
  'function enableSessionWithRefund(bytes32 permissionId, address sessionKey, uint48 validUntil, address resolver, address refundToken, uint96 maxRefundExchangeRate, uint48 maxRefundGasOverhead, uint96 maxRefundAmount)',
])

export function buildEnableSessionWithRefundCall(params: {
  readonly chainId: number
  readonly permissionId: Hex
  readonly sessionKey: Address
  readonly validUntil: bigint
  readonly resolver: Address
}): { to: Address; value: bigint; data: Hex } {
  const c = getDestinationContracts(params.chainId)
  return {
    to: c.hcaOwnerAndSessionValidator,
    value: 0n,
    data: encodeFunctionData({
      abi: enableSessionWithRefundAbi,
      functionName: 'enableSessionWithRefund',
      args: [
        params.permissionId,
        params.sessionKey,
        Number(params.validUntil),
        params.resolver,
        c.usdc,
        MAX_REFUND_EXCHANGE_RATE,
        Number(MAX_REFUND_GAS_OVERHEAD),
        MAX_REFUND_AMOUNT,
      ],
    }),
  }
}

/**
 * Rebuild the SDK `Session` object from a stored/persisted session, WITHOUT a
 * new wallet prompt. Recomputes the exact salt (so the `permissionId` matches)
 * and re-derives the ephemeral session-key account from its private key.
 *
 * Used on resume: the app persists the scalar fields (nonce, validUntil,
 * resolver, key) and rebuilds the `Session` + `SessionEnableData` to hand to
 * the Rhinestone signer.
 */
export function rebuildDestinationSession(params: {
  readonly chain: Chain
  readonly hca: Address
  readonly resolver: Address
  readonly hcaSessionNonce: bigint
  readonly validUntil: bigint
  readonly sessionPrivateKey: Hex
}): { session: StandaloneHcaSession; permissionId: Hex } {
  const c = getDestinationContracts(params.chain.id)
  const salt = computeDestinationSessionSalt({
    hcaSessionNonce: params.hcaSessionNonce,
    validUntil: params.validUntil,
    resolver: params.resolver,
    refundToken: c.usdc,
  })
  const session: StandaloneHcaSession = {
    chain: params.chain,
    account: params.hca,
    salt,
    owners: {
      type: 'ecdsa',
      accounts: [privateKeyToAccount(params.sessionPrivateKey)],
    },
  }
  return { session, permissionId: getPermissionId(session) }
}
