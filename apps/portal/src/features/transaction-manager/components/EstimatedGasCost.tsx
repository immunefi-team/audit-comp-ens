import type { TransactionMachineActor } from '@ens-apps/transaction-manager'
import { AlertCircle, Info } from 'lucide-react'
import { fromThrowable } from 'neverthrow'
import { type ComponentType, useMemo } from 'react'
import { match } from 'ts-pattern'
import { useWalletClient } from 'wagmi'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { sepoliaWithEns } from '@/lib/wagmi'
import type { WalletClientWithAccount } from '@/utils/types'
import { useTransactionGasEstimate } from '../hooks/useTransactionGasEstimate'
import type { Transaction } from '../types'

/** An icon + label that reveals an explanation on hover/focus. */
const EstimateHint = ({
  icon: Icon,
  label,
  tip,
}: {
  readonly icon: ComponentType<{ className?: string }>
  readonly label: string
  readonly tip: string
}) => (
  <Tooltip>
    <TooltipTrigger className="inline-flex items-center gap-1 text-muted-foreground cursor-help">
      <Icon className="size-3.5 shrink-0" />
      {label}
    </TooltipTrigger>
    <TooltipContent className="max-w-xs font-sans normal-case">
      {tip}
    </TooltipContent>
  </Tooltip>
)

/**
 * A transaction's estimated cost, from a live `eth_estimateGas` on its encoded
 * call. Owns the wallet/chain plumbing for every step: it reads the (global)
 * wallet client once, and — only when it's ready (account + chain) — asks the
 * step to build its intent. The builders throw on bad state, so the call is
 * wrapped with neverthrow's `fromThrowable` → `undefined`. Descriptor sites
 * therefore never touch the wallet, guard readiness, or risk crashing the render.
 *
 * Renders four honest states: the cost on success, "Estimating…" only while it's
 * actually calculating, and — with an explanatory tooltip — "Unavailable" when
 * the call would revert, or a neutral hint when there's nothing to estimate yet.
 */
export const EstimatedGasCost = ({
  actor,
  intent,
}: {
  readonly actor: TransactionMachineActor | undefined
  /** The step's estimate config — see {@link Transaction.intent}. */
  readonly intent?: Transaction['intent']
}) => {
  const {
    prepare: prepareIntent,
    isPending: prepareIntentPending = false,
    isError: prepareIntentError = false,
  } = intent ?? {}
  const { data: walletClient } = useWalletClient()
  // Only estimate against a ready wallet: an account (the `from`) and a resolved
  // chain, which the builders need to encode calldata. We don't pin to a specific
  // chain here — `eth_estimateGas` only needs `from`, and the estimate hook
  // already scopes its public client to the intent's target chain. `undefined`
  // otherwise, so we skip estimation instead.
  const readyWalletClient =
    walletClient?.account && walletClient.chain
      ? (walletClient as WalletClientWithAccount)
      : undefined

  // Memoize on the inputs that change the intent so the modal's actor-snapshot
  // re-renders don't re-run `encodeFunctionData` (and, some flows, ensjs
  // write-param encoding) on every render.
  const preparedIntent = useMemo(
    () =>
      readyWalletClient && prepareIntent
        ? fromThrowable(prepareIntent, (error) => {
            // A throw here is expected UI-state churn (no fuses selected, no
            // record changes yet) and maps to the neutral "nothing to estimate"
            // hint. But wallet readiness is already guaranteed above, so a real
            // builder bug throws too — surface it in dev so it doesn't vanish
            // silently behind that same hint.
            if (import.meta.env.DEV) {
              console.warn('prepareIntent threw during gas estimate:', error)
            }
            return undefined
          })({
            walletClient: readyWalletClient,
            chainId: sepoliaWithEns.id,
          }).unwrapOr(undefined)
        : undefined,
    [readyWalletClient, prepareIntent],
  )

  const { cost, status: gasStatus } = useTransactionGasEstimate(
    actor,
    preparedIntent?.request,
  )

  // An async-intent flow (see the props above) surfaces its own resolution
  // state: a failed resolution is "Unavailable" and a pending one is
  // "Estimating…", overriding the gas query — which can't run until the intent
  // exists. Only applies before the step starts (the machine holds the real
  // request once running), so skip the override once the actor drives the call.
  const hasActiveRequest = actor?.getSnapshot()?.context.request?.type === 'eoa'
  const status = match({
    hasActiveRequest,
    prepareIntentError,
    prepareIntentPending,
    hasIntent: preparedIntent !== undefined,
  })
    .with(
      { hasActiveRequest: false, prepareIntentError: true },
      () => 'error' as const,
    )
    .with(
      { hasActiveRequest: false, prepareIntentPending: true, hasIntent: false },
      () => 'loading' as const,
    )
    .otherwise(() => gasStatus)

  return match(status)
    .with('success', () => <>{`${cost} ETH`}</>)
    .with('loading', () => <>{'Estimating…'}</>)
    .with('error', () => (
      <EstimateHint
        icon={AlertCircle}
        label="Unavailable"
        tip="This transaction can't be estimated — as configured it would fail on-chain (for example a missing role or an unmet prerequisite)."
      />
    ))
    .with('idle', () => (
      <EstimateHint
        icon={Info}
        label="Not yet"
        tip={match({
          hasPrepareIntent: Boolean(prepareIntent),
          hasReadyWallet: Boolean(readyWalletClient),
        })
          .with(
            { hasPrepareIntent: false },
            () =>
              "This step's cost is estimated once it starts — it can't be worked out ahead of time.",
          )
          .with({ hasReadyWallet: false }, () => 'Connect your wallet')
          .otherwise(() => 'Preparing the estimate…')}
      />
    ))
    .exhaustive()
}
