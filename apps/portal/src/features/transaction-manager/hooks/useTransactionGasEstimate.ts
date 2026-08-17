import type {
  EOATransactionRequest,
  TransactionMachineActor,
  TransactionRequest,
} from '@ens-apps/transaction-manager'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  formatEther,
  type PublicClient,
} from 'viem'
import { useEstimateFeesPerGas, usePublicClient } from 'wagmi'

/**
 * The estimate's state, so callers can show honest UI:
 * - `idle` — no call to estimate yet (no descriptor intent, wallet not ready, or
 *   step not started), or the estimate couldn't be produced for a transient
 *   reason. Nothing is being calculated right now.
 * - `loading` — actively running `eth_estimateGas`.
 * - `error` — the call actually reverts on-chain (a real "this would fail").
 * - `success` — `cost` holds the estimate.
 */
export type GasEstimateStatus = 'idle' | 'loading' | 'error' | 'success'

// Freeze the preview: the estimate is computed once when the modal opens and
// held stable rather than silently refetched. A background refetch would flash
// the cached number and then jump to a fresher one as the base fee moved, which
// reads as glitchy. It's still re-estimated for real when the step starts (the
// gas query key flips on `activeRequest`), and react-query drops the cache a few
// minutes after the modal closes, so a later session recomputes fresh.
const PREVIEW_STALE_TIME = Number.POSITIVE_INFINITY

// Transient RPC failures (timeouts, rate-limits, transport blips) are worth a
// couple of retries; a genuine on-chain revert is deterministic and never is.
const MAX_TRANSIENT_RETRIES = 2

// Gas costs are tiny ETH amounts; `formatEther` alone yields an 18-decimal
// string. Round to a few significant digits for a readable "Est. cost".
const formatGasCost = (wei: bigint): string =>
  Number(formatEther(wei)).toLocaleString('en-US', {
    maximumSignificantDigits: 4,
  })

/**
 * Distinguishes an `eth_estimateGas` failure that is the call *actually
 * reverting on-chain* (a real "this would fail" signal worth surfacing) from a
 * transient transport problem (timeout, rate-limit, RPC blip). Only a genuine
 * revert should be shown to the user as "Unavailable"; a transient blip must not
 * claim the transaction would fail.
 */
export const isRevertError = (error: unknown): boolean =>
  error instanceof BaseError &&
  error.walk(
    (e) =>
      e instanceof ExecutionRevertedError ||
      e instanceof ContractFunctionRevertedError,
  ) != null

/**
 * Runs `eth_estimateGas` for an EOA call. Some intents carry an explicit gas cap
 * because live estimation is unreliable for that call (e.g. setSubregistry's
 * 500000n). Prefer a real estimate, but if the call reverts under estimation
 * fall back to the intent's cap — the tx submits fine with that cap, so
 * surfacing "Unavailable" would be wrong. Transient errors still bubble up so
 * react-query can retry them.
 */
export const estimateGasForCall = async (
  publicClient: PublicClient,
  eoa: EOATransactionRequest,
): Promise<bigint> => {
  const runEstimate = () =>
    publicClient.estimateGas({
      account: eoa.from,
      to: eoa.to,
      data: eoa.data,
      value: eoa.value,
    })

  if (eoa.gas == null) return runEstimate()

  try {
    return await runEstimate()
  } catch (error) {
    if (isRevertError(error)) return eoa.gas
    throw error
  }
}

/**
 * Derives the honest {@link GasEstimateStatus} from the two queries. Only a
 * genuine on-chain revert becomes `error` ("Unavailable"); a transient RPC
 * failure (after retries) or a fee-lookup failure falls back to the neutral
 * `idle` hint so the UI neither lies about a revert nor hangs on "Estimating…".
 */
export const deriveStatus = (
  gasQuery: UseQueryResult<bigint>,
  feeHasError: boolean,
  hasCost: boolean,
): GasEstimateStatus => {
  if (gasQuery.fetchStatus === 'idle' && gasQuery.status === 'pending') {
    return 'idle'
  }
  if (gasQuery.isError && isRevertError(gasQuery.error)) return 'error'
  if (hasCost) return 'success'
  const hasUnrecoverableTransientError = gasQuery.isError || feeHasError
  return hasUnrecoverableTransientError ? 'idle' : 'loading'
}

/**
 * Live gas cost (in ETH) for a transaction, via a single `eth_estimateGas` on
 * its encoded call. Prefers the call the machine holds in its context once the
 * step is started; before that it falls back to `fallbackRequest` — the call
 * from the descriptor's pre-built intent — so the estimate shows immediately.
 *
 * Returns `{ cost, status }` (see {@link GasEstimateStatus}): `cost` is the
 * formatted ETH string on success and `null` otherwise; `status` distinguishes
 * "nothing to estimate yet" (`idle`) from "calculating" (`loading`), a reverted
 * call (`error`), and a resolved estimate (`success`).
 */
export const useTransactionGasEstimate = (
  actor: TransactionMachineActor | undefined,
  fallbackRequest?: TransactionRequest,
): { cost: string | null; status: GasEstimateStatus } => {
  // Read the machine reactively: `getSnapshot()` during render doesn't subscribe,
  // so the hook would only re-run when some parent re-renders. `useSelector`
  // subscribes to the actor and re-renders this hook when `request`/`receipt`
  // actually change (it passes `undefined` to the selector when `actor` is).
  const activeRequest = useSelector(actor, (s) => s?.context.request)
  const receipt = useSelector(actor, (s) => s?.context.receipt)
  const candidate =
    activeRequest?.type === 'eoa' ? activeRequest : fallbackRequest
  const eoa = candidate?.type === 'eoa' ? candidate : null

  // Estimate against the chain the transaction actually targets, not whatever
  // chain the wallet happens to be on. Returns undefined (→ disabled) when the
  // target chain isn't in the wagmi config, so we never show a wrong-chain cost.
  const publicClient = usePublicClient({ chainId: eoa?.chainId })

  // Price the estimate on the same fee model the transaction manager submits
  // under: EIP-1559. `maxFeePerGas` is the per-gas ceiling the user could pay, so
  // `gas * maxFeePerGas` is the honest upper-bound cost — not legacy
  // `eth_gasPrice`, which prices a fee model we don't use. wagmi's hook already
  // handles chain scoping, query keys and caching for us.
  const feeQuery = useEstimateFeesPerGas({
    chainId: eoa?.chainId,
    query: {
      enabled: Boolean(publicClient) && eoa?.chainId !== undefined,
      staleTime: PREVIEW_STALE_TIME,
      refetchOnWindowFocus: false,
      retry: MAX_TRANSIENT_RETRIES,
    },
  })

  const gasQuery = useQuery({
    queryKey: [
      'tx-gas-estimate',
      eoa?.chainId,
      eoa?.from,
      eoa?.to,
      eoa?.data,
      eoa?.value?.toString(),
      eoa?.gas?.toString(),
      // Re-estimate once the step is actually started: a call that reverted
      // at modal-open (e.g. a renew before its approval, or any precondition
      // set by an earlier step) can succeed now that the prior step has run.
      Boolean(activeRequest),
    ],
    enabled: Boolean(eoa?.to && eoa?.data && publicClient && !receipt),
    staleTime: PREVIEW_STALE_TIME,
    refetchOnWindowFocus: false,
    // Retry transient RPC failures, but never a genuine revert — that verdict
    // won't change, so retrying it just delays the honest "Unavailable".
    retry: (failureCount, error) =>
      !isRevertError(error) && failureCount < MAX_TRANSIENT_RETRIES,
    queryFn: (): Promise<bigint> => {
      if (!eoa || !publicClient) throw new Error('No call to estimate')
      return estimateGasForCall(publicClient, eoa)
    },
  })

  // A settled step shows its ACTUAL fee (gasUsed × effectiveGasPrice) from the
  // receipt, never a live re-estimate. Re-estimating a finished call is
  // meaningless, and for a non-repeatable call — e.g. the deterministic CREATE2
  // subregistry deploy — it reverts once mined (the proxy now exists), which
  // wrongly flipped a completed step from its cost to "Unavailable". Placed
  // after the hooks above so hook order stays stable across renders.
  if (receipt != null) {
    return receipt.status === 'success'
      ? {
          cost: formatGasCost(receipt.gasUsed * receipt.effectiveGasPrice),
          status: 'success',
        }
      : { cost: null, status: 'error' }
  }

  const gas = gasQuery.data
  const maxFeePerGas = feeQuery.data?.maxFeePerGas
  const cost =
    gas != null && maxFeePerGas != null
      ? formatGasCost(gas * maxFeePerGas)
      : null

  return {
    cost,
    status: deriveStatus(gasQuery, feeQuery.isError, cost != null),
  }
}
