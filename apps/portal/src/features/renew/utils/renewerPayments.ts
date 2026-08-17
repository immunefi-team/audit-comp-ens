import type { Address } from 'viem'
import type {
  MultiRenewalEntry,
  RenewerPayment,
} from '../hooks/useRenewalTransactions'
import { getRenewerAddress } from './renewer'

// One name's contribution to a batch's approvals: which renewer (ERC-20 spender)
// must be paid, and how much it owes for this name in the chosen token.
type RenewerCharge = {
  readonly renewer: Address
  readonly total: bigint
}

/**
 * Distinct renewer contracts among a batch's names, in first-seen order — the
 * ERC-20 spenders the flow must price against and read allowances for. A
 * same-kind batch yields one; a mixed v1+v2 batch yields two.
 */
export const distinctRenewers = (
  renewals: readonly MultiRenewalEntry[],
): Address[] => {
  const seen = new Set<Address>()
  for (const renewal of renewals) {
    seen.add(getRenewerAddress(renewal.selectedName.isV2))
  }
  return [...seen]
}

/**
 * Collapse per-name charges into one `RenewerPayment` per distinct renewer:
 * summing each renewer's owed total and attaching its current allowance. A
 * same-kind batch yields one payment; a mixed v1+v2 batch yields two (one per
 * renewer contract), which drives the flow's per-spender approval step(s).
 * Renewers appear in first-seen order.
 */
export const computeRenewerPayments = (
  charges: readonly RenewerCharge[],
  allowanceByRenewer: (renewer: Address) => bigint,
): RenewerPayment[] => {
  const totals = new Map<Address, bigint>()
  for (const { renewer, total } of charges) {
    totals.set(renewer, (totals.get(renewer) ?? 0n) + total)
  }
  return [...totals].map(([renewer, total]) => ({
    renewer,
    total,
    allowance: allowanceByRenewer(renewer),
  }))
}

// One ordered step of a multi-renew batch, as a plain description (no wallet/
// transaction-manager coupling) so the ordering + approval decisions are pure
// and unit-testable. The hook maps each step to a Transaction.
export type MultiRenewStep =
  | {
      readonly kind: 'approve'
      readonly renewer: Address
      readonly total: bigint
      /** Only the first approval resets the manager; later ones skip the clear. */
      readonly skipClear: boolean
    }
  | {
      readonly kind: 'renew'
      readonly name: string
      readonly duration: number
      readonly isV2: boolean
    }

/**
 * Order a batch into approve-then-renew steps. One approval per renewer whose
 * current allowance can't cover its owed total (ERC-20 allowance is per-spender,
 * so a mixed v1+v2 batch needs one per renewer); the first such approval clears
 * the manager and the rest skip it. Renews follow, one per name. An empty batch
 * yields no steps.
 */
export const planMultiRenewSteps = (
  renewals: readonly MultiRenewalEntry[],
  payments: readonly RenewerPayment[],
): MultiRenewStep[] => {
  if (renewals.length === 0) return []

  const approveSteps: MultiRenewStep[] = payments
    .filter((payment) => payment.allowance < payment.total)
    .map((payment, index) => ({
      kind: 'approve',
      renewer: payment.renewer,
      total: payment.total,
      skipClear: index > 0,
    }))

  const renewSteps: MultiRenewStep[] = renewals.map((renewal) => ({
    kind: 'renew',
    name: renewal.selectedName.name,
    duration: renewal.duration,
    isV2: renewal.selectedName.isV2,
  }))

  return [...approveSteps, ...renewSteps]
}
