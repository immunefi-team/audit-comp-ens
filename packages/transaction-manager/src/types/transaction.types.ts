import type { ChainSessionConfig, TokenRequest } from '@rhinestone/sdk'

/**
 * There is deliberately NO sponsorship knob on this type.
 *
 * Gas sponsorship does not exist on the standalone-HCA deployment: every
 * intent is user-paid in USDC out of the HCA's own balance, funded by an
 * EIP-2612 permit (see `signer.types.ts`). The SDK still takes a `sponsored`
 * argument, so the warp transport passes the user-paid shape and nothing else
 * — see `UNSPONSORED` there. Callers cannot opt in, and there is no flag that
 * turns it on, because asking for a subsidy no relayer here offers fails late
 * and unhelpfully.
 */

/**
 * Per-session enable payload for `experimental_session` signing. Derived via
 * indexed access — the SDK does not export it from its public surface.
 */
export type SessionEnableData = NonNullable<ChainSessionConfig['enableData']>

import type {
  Address,
  Chain,
  Hash,
  Hex,
  PublicClient,
  TransactionReceipt,
  WalletClient,
} from 'viem'
import type { TransactionInfra } from './signer.types'

export type TransactionType = 'eoa' | 'rhinestone-intent'

/**
 * Fields shared by every transaction request, regardless of how it is
 * submitted on-chain. Deliberately does NOT include call data
 * (`to`/`data`/`value`): single-call requests (EOA) carry those at the top
 * level, while batched requests (Rhinestone intents) carry them inside
 * `rhinestoneParams.calls` as the single source of truth.
 */
export interface BaseTransactionRequest {
  type: TransactionType
  from: Address
  chainId: number
}

export interface EOATransactionRequest extends BaseTransactionRequest {
  type: 'eoa'
  to: Address
  value?: bigint
  data?: Hex
  gas?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
}

/**
 * Neutral call shape used by batched transaction requests (Rhinestone
 * intents today; potentially other batchable signers in the future).
 *
 * Also re-used by code paths that build up call lists ahead of time
 * (e.g. the migration service), independent of which transport submits
 * them.
 */
export interface Call {
  to: Address
  data: Hex
  value: bigint
}

export interface RhinestoneIntentParams {
  /**
   * The calls executed on-chain — the single source of truth for what this
   * intent does. The first entry is treated as the "primary" call for
   * summaries/telemetry; see {@link getPrimaryCall}. Must be non-empty.
   */
  readonly calls: readonly Call[]
  /** Fee asset the HCA pays from. Defaults to USDC in the transport. */
  readonly feeAsset?: 'USDC'
  /**
   * Per-request session enable payload. Present ONLY on the request that
   * carries the on-chain `enableSessionWithRefund` call (the first HCA
   * action); omitted once the session is enabled. Requires a signer with a
   * `session` — the transport rejects it otherwise.
   */
  readonly sessionEnableData?: SessionEnableData
  /** Token requests for cross-chain txs. Defaults to [] (skip balance validation). */
  readonly tokenRequests?: readonly TokenRequest[]
  /**
   * Balances that will land DURING this intent and so are invisible to the
   * orchestrator when it plans, keyed by chain then token.
   *
   * The planner credits only what it can already see, and refuses to quote when
   * the account cannot cover the fee. The standalone-HCA route funds the HCA
   * from the owner's `permit` + `transferFrom` *inside* the same batch, so
   * without this declaration the inflow does not exist as far as planning is
   * concerned and the intent is rejected with `NO_PLAN_AVAILABLE` whenever the
   * HCA's standing balance sits below the quoted fee.
   *
   * Declare ONLY the incoming amount. Listing funds the account already holds
   * double-counts them and inflates the quote's input amount — see
   * https://docs.rhinestone.dev/intents/guides/getting-a-quote#auxiliary-funds
   */
  readonly auxiliaryFunds?: Readonly<
    Record<number, Readonly<Record<Address, bigint>>>
  >
}

/**
 * A Rhinestone (chain-abstraction) intent request.
 *
 * Unlike {@link EOATransactionRequest}, this type intentionally does NOT carry
 * top-level `to`/`data`/`value`. The call data lives exclusively in
 * `rhinestoneParams.calls`, which is the array actually submitted on-chain by
 * the Warp/Rhinestone transports. Keeping a single copy removes the
 * "two sources of truth that can silently diverge" class of bug for
 * multi-call intents (e.g. deploy + commit). To derive a representative
 * `{ to, data, value }` for logging/telemetry, use {@link getPrimaryCall}.
 */
export interface RhinestoneTransactionRequest extends BaseTransactionRequest {
  type: 'rhinestone-intent'
  rhinestoneParams: RhinestoneIntentParams
}

export type TransactionRequest =
  | EOATransactionRequest
  | RhinestoneTransactionRequest

/**
 * Resolve the representative call for a request as `{ to, data, value }`.
 *
 * - EOA requests carry these at the top level.
 * - Rhinestone intents derive them from the first canonical call in
 *   `rhinestoneParams.calls` (the primary call). Returns `undefined` only if
 *   an intent has an empty `calls` array, which transports reject anyway.
 *
 * This keeps consumers (telemetry, logging) reading a single source of truth
 * instead of a second, divergence-prone copy of the call data.
 */
export function getPrimaryCall(
  request: TransactionRequest,
): { to: Address; data?: Hex; value?: bigint } | undefined {
  if (request.type === 'eoa') {
    return { to: request.to, data: request.data, value: request.value }
  }

  const primary = request.rhinestoneParams.calls[0]
  if (!primary) return undefined
  return { to: primary.to, data: primary.data, value: primary.value }
}

// Transaction Intents - High-level descriptions of what the user wants to do
// (Distinct from Rhinestone intents, which are chain abstraction intents)
export interface ENSRenewalTransactionIntent {
  type: 'ens-renewal'
  name: string // ENS name without .eth (e.g., "leon")
  duration: bigint // Duration in seconds
  from: Hex // Address of the account (EOA or smart account)
}

export interface ETHTransferTransactionIntent {
  type: 'eth-transfer'
  to: Hex
  value: bigint
  from: Hex
  data?: Hex
}

export interface CustomTransactionIntent {
  type: 'custom'
  request: TransactionRequest // Escape hatch for pre-prepared transactions
}

export type TransactionIntent =
  | ENSRenewalTransactionIntent
  | ETHTransferTransactionIntent
  | CustomTransactionIntent

/**
 * Smart Account Configuration
 *
 * Config interface for the Rhinestone smart-account signer.
 */
export type SmartAccountConfig = {
  chain?: Chain
  accountAddress?: Address
  rhinestoneApiKey: string
}

export interface TransactionOptions {
  usePrivateMempool?: boolean
  confirmations?: number
  timeout?: number
  retryCount?: number
  retryDelay?: number
  smartAccountConfig?: SmartAccountConfig
  description?: string
  modal?: Partial<TransactionModalState>
  id?: string
  publicClient?: PublicClient
  walletClient?: WalletClient
  /** Override the infrastructure for this transaction (Warp-only today) */
  infrastructure?: TransactionInfra
  /**
   * Operation kind for transaction-history reporting, e.g. 'ens-renewal',
   * 'registration', 'set-resolver', 'set-primary-name', 'custom'. The semantic
   * operation is known by the caller (app/feature flow), not the core machine,
   * so it is supplied here and surfaced on the archived record.
   */
  operation?: string
  /** ENS name involved, for transaction-history display. */
  name?: string
}

export interface TransactionResult {
  hash: Hash
  receipt?: TransactionReceipt
  userOpHash?: Hash // For ERC-4337
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: number
}

// Modal-related types
export type PaymentMethod =
  | 'eth'
  | 'namechain-eth'
  | 'usdc'
  | 'mainnet-usdc'
  | 'base-usdc'

export interface PaymentOption {
  method: PaymentMethod
  label: string
  balance?: string
  icon?: string
  network?: string
}

export interface TransactionStep {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  hash?: Hash
  error?: string
}

export type TransactionFlowType = 'single' | 'bridge' | 'batched'

export interface TransactionModalState {
  isOpen: boolean
  title?: string
  ensName?: string
  avatarUrl?: string
  network?: string
  estimatedCost?: string
  steps?: TransactionStep[]
  currentStepIndex?: number
  flowType?: TransactionFlowType
  selectedPayment?: PaymentMethod
  paymentOptions?: PaymentOption[]
}
