import type { Signer } from '@ens-apps/transaction-manager'
import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import {
  pollTransactionStatusActor,
  readPaymentTokenAllowanceActor,
  submitApprovalActor,
  submitRenewActor,
} from '@ens-apps/transaction-manager/machines/registration/registration.actors'
import { $qk, qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { ok, okAsync, type Result, type ResultAsync } from 'neverthrow'
import { useCallback, useRef, useState } from 'react'
import type { Address, WalletClient } from 'viem'
import { useSmartAccountContext } from '@/lib/smart-account'
import { publicClient } from '@/lib/wagmi'
import { getQueryClient } from '@/utils/router/root-context'
import type { BulkRenewPhase, RenewItem, RowStatus } from '../types'

// How long to hold the completed progress bar before showing the success view.
const SETTLE_MS = 600

// Renewal is not an HCA flow: allowance check + approve target the canonical
// registrar + token that `submitRenewActor` renews against, which is what the
// actors already default to. Mirrors `renew/state/renewalUi.machine.ts`.

// Bulk renewal takes the DIRECT WALLET route, like single renewal: the connected
// EOA approves once and then renews each name itself.
//
// It cannot go through the HCA. `AbstractETHRegistrar.renew` charges
// `msg.sender` with no HCA unwrap, and the scoped session's policy allowlists
// only `commit`/`register` on the registrar — a session-signed `renew` reverts
// `ActionNotAllowed`. Routing it through the HCA would therefore mean paying
// from the HCA (needing a funding permit) and signing the intent with the owner
// key to bypass the policy. That was rejected in favour of keeping renewal on
// the wallet, at the cost of one transaction per name instead of one atomic
// batch.
export const WALLET_REQUIRED_MESSAGE =
  'Bulk renewal requires a connected wallet to approve and pay for each renewal.'

type Context = {
  /** The connected EOA — `_msgSender()` for `renew`, and the rent payer. */
  readonly signer: Signer
  readonly ownerAddress: Address
  readonly token: SUPPORTED_TOKEN
}

/**
 * Authorize the whole batch once: approve the registrar for the summed price so
 * the individual `renew` calls can each pull from the same allowance. Resolves
 * immediately when the existing allowance already covers the batch.
 */
const authorizeSpend = (
  ctx: Context,
  sumPriceRaw: bigint,
): ResultAsync<void, Error> =>
  readPaymentTokenAllowanceActor({
    owner: ctx.ownerAddress,
    selectedToken: ctx.token,
    publicClient,
  })
    // A read failure shouldn't block — fall back to authorizing.
    .orElse(() => okAsync(0n))
    .andThen((allowance): ResultAsync<void, Error> => {
      if (allowance >= sumPriceRaw) return okAsync(undefined)

      return submitApprovalActor({
        tokenPrice: sumPriceRaw,
        selectedToken: ctx.token,
        signer: ctx.signer,
        publicClient,
      })
        .andThen((txId) => pollTransactionStatusActor({ txId }))
        .map(() => undefined)
    })

/** Renew one name and wait for it to land. */
const renewOne = (ctx: Context, item: RenewItem): ResultAsync<void, Error> =>
  submitRenewActor({
    label: item.label,
    duration: item.duration,
    selectedToken: ctx.token,
    signer: ctx.signer,
    publicClient,
  })
    .andThen((txId) => pollTransactionStatusActor({ txId }))
    .map(() => undefined)

/**
 * Renew each name in turn, reporting per-row progress.
 *
 * Sequential rather than atomic: each name is its own transaction, so a failure
 * part-way leaves the earlier names genuinely renewed. `onDone` records them so
 * a retry resumes from the first failure instead of re-paying for the batch.
 */
const runRenewals = async (
  ctx: Context,
  remaining: readonly RenewItem[],
  onActive: (label: string) => void,
  onDone: (label: string) => void,
): Promise<Result<void, Error>> => {
  for (const item of remaining) {
    onActive(item.label)
    const renewed = await renewOne(ctx, item)
    if (renewed.isErr()) return renewed
    onDone(item.label)
  }
  return ok(undefined)
}

/** Sentinel returned by `prepareSpend` when the run was superseded mid-flight. */
const STALE = Symbol('stale-run')

/**
 * Drive the `authorizing` phase. Returns an `Error` to fail with, or `STALE` if
 * the run was superseded (dialog reset) while awaiting.
 */
const prepareSpend = async (
  ctx: Context,
  sumPriceRaw: bigint,
  isCurrent: () => boolean,
  setPhase: (phase: BulkRenewPhase) => void,
): Promise<undefined | Error | typeof STALE> => {
  setPhase('authorizing')
  const authorized = await authorizeSpend(ctx, sumPriceRaw)
  if (!isCurrent()) return STALE
  if (authorized.isErr()) return authorized.error
  return undefined
}

type SmartAccount = ReturnType<typeof useSmartAccountContext>

/**
 * Resolve the signer/owner context, or `null` if no wallet is connected.
 *
 * The owner is the connected wallet, NOT `account.ownerAddress` — `renew`
 * charges whoever sends it, so the allowance must be read for and authorized by
 * the same EOA that submits.
 */
const resolveContext = (
  account: SmartAccount,
  token: SUPPORTED_TOKEN,
): Context | null => {
  const walletClient = account.walletClient
  const ownerAddress = walletClient?.account?.address
  if (!walletClient || !ownerAddress) return null
  return {
    signer: { type: 'eoa', walletClient: walletClient as WalletClient },
    ownerAddress,
    token,
  }
}

/** Refresh a single renewed name's profile/expiry queries. */
const invalidateName = (label: string) =>
  getQueryClient()?.invalidateQueries({
    queryKey: $qk({ name: `${label}.eth` }),
  })

/** Refresh the dashboard owned-names list so renewed expiries update. */
const invalidateDashboardNames = () =>
  getQueryClient()?.invalidateQueries({
    queryKey: qk('dashboard', 'all_domains'),
  })

type SubmitArgs = {
  readonly items: readonly RenewItem[]
  readonly token: SUPPORTED_TOKEN
  /** Summed quoted price in token units, used to size the allowance. */
  readonly sumPriceRaw: bigint
}

export type UseBulkRenewSubmit = {
  readonly phase: BulkRenewPhase
  readonly statuses: Readonly<Record<string, RowStatus>>
  readonly errorMessage: string | undefined
  readonly submit: (args: SubmitArgs) => Promise<void>
  readonly reset: () => void
}

/**
 * Drives the bulk renewal on the direct-wallet route: approve the summed spend
 * once, then renew each name in its own transaction. Names that already renewed
 * are remembered so a retry resumes rather than re-paying.
 */
export const useBulkRenewSubmit = (): UseBulkRenewSubmit => {
  const account = useSmartAccountContext()
  const [phase, setPhase] = useState<BulkRenewPhase>('idle')
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const completedRef = useRef<Set<string>>(new Set())
  // Monotonic id for the active submission. Bumped on every `submit` and on
  // `reset`, so a submission that resolves after the dialog was closed/reopened
  // (which calls `reset`) can detect it's stale and skip its UI updates — e.g.
  // no phantom "success" screen landing on a freshly reopened dialog.
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    runIdRef.current += 1
    completedRef.current = new Set()
    setPhase('idle')
    setStatuses({})
    setErrorMessage(undefined)
  }, [])

  const markStatus = (label: string, status: RowStatus) =>
    setStatuses((prev) => ({ ...prev, [label]: status }))

  const failWith = (error: Error) => {
    setErrorMessage(error.message)
    setStatuses((prev) => {
      const next = { ...prev }
      for (const label of Object.keys(next)) {
        if (next[label] === 'active') next[label] = 'error'
      }
      return next
    })
    // Refresh whatever DID renew before the failure.
    invalidateDashboardNames()
    setPhase('error')
  }

  const submit = async ({ items, token, sumPriceRaw }: SubmitArgs) => {
    // Claim this run; if `reset` (or another submit) bumps the id while we await,
    // `isCurrent()` turns false and we stop touching the now-stale UI state.
    runIdRef.current += 1
    const runId = runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    const ctx = resolveContext(account, token)
    if (!ctx) {
      setErrorMessage(WALLET_REQUIRED_MESSAGE)
      setPhase('error')
      return
    }

    // Skip names already renewed in an earlier attempt (retry resumes failures).
    const completed = completedRef.current
    const remaining = items.filter((item) => !completed.has(item.label))

    setErrorMessage(undefined)
    setStatuses(
      Object.fromEntries(
        items.map((item) => [
          item.label,
          completed.has(item.label) ? 'done' : 'pending',
        ]),
      ),
    )

    const prepared = await prepareSpend(ctx, sumPriceRaw, isCurrent, setPhase)
    if (prepared === STALE) return
    if (prepared instanceof Error) return failWith(prepared)

    setPhase('renewing')
    const renewed = await runRenewals(
      ctx,
      remaining,
      (label) => isCurrent() && markStatus(label, 'active'),
      (label) => {
        // The renewal landed on-chain, so record it and refresh data even if the
        // dialog was reset mid-flight; only the row-status UI is run-scoped.
        completed.add(label)
        invalidateName(label)
        if (isCurrent()) markStatus(label, 'done')
      },
    )
    if (!isCurrent()) return
    if (renewed.isErr()) return failWith(renewed.error)

    invalidateDashboardNames()
    // Let the bar settle at 100% before flipping to the success view.
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    if (!isCurrent()) return
    setPhase('success')
  }

  return { phase, statuses, errorMessage, submit, reset }
}
