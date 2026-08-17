import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import type { WalletClientWithAccount } from '@/utils/types'

/**
 * The globally-available wallet context the modal injects when it resolves a
 * step's intent for the gas estimate. Because `walletClient` (a wagmi hook) and
 * the app `chainId` are global, descriptor sites don't read or guard them — the
 * modal supplies a ready wallet (account + chain present) exactly once.
 */
export type IntentContext = {
  readonly walletClient: WalletClientWithAccount
  readonly chainId: number
}

export type TransactionModalContentState =
  | {
      readonly type: 'overview'
    }
  | {
      readonly type: 'info'
      readonly transactionId: string
    }
  | {
      readonly type: 'state'
      readonly transactionId: string
    }

export type Transaction = {
  readonly id: string
  readonly title: string
  readonly transactionName: string
  readonly onDone: () => void
  readonly onStart: () => void
  readonly steps?: readonly string[]
  /**
   * How this step's cost is estimated ahead of time. Omit the whole object for
   * steps whose calldata is only known at runtime (e.g. the registration
   * commit/register steps, or a deploy-then-set step whose target address is only
   * known once a prior deploy is mined); those estimate once the step starts.
   */
  readonly intent?: {
    /**
     * Lazily builds the prepared transaction for this step from the wallet
     * context the modal injects. The modal calls it only when the wallet is ready
     * (account + chain present) and catches any throw, so descriptor sites never
     * read or guard the wallet/chain and never crash the render. The modal reads
     * `.request` for the live `eth_estimateGas`, shown the moment the modal opens;
     * `onStart` submits the same call through the shared `prepare<Op>Transaction`
     * builder, so the estimate cannot drift from what's submitted. Return
     * `undefined` for a call whose data isn't ready yet.
     */
    readonly prepare?: (
      ctx: IntentContext,
    ) => CustomTransactionIntent | undefined
    /**
     * Async-intent bridge. Most steps build their intent synchronously in
     * `prepare`, but a few must resolve it off-chain first (e.g. saving records
     * resolves the resolver pattern on-chain). Those flows drive the resolution
     * in their own query and hand its state here so the estimate can show
     * "Estimating…" while it's pending and "Unavailable" if it fails, instead of
     * a permanent "Not yet" when `prepare` keeps returning `undefined`.
     */
    readonly isPending?: boolean
    readonly isError?: boolean
  }
  /**
   * Unix timestamp (ms) at which this transaction can start. When set and in
   * the future, the modal renders a countdown on the step instead of letting
   * the user trigger it. Used for the registration commit-reveal cooldown.
   */
  readonly waitUntil?: number
}
