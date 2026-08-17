import type { HcaBudgetBreakdown } from '@ens-apps/smart-account'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

/**
 * What the standalone-HCA route debits the wallet, itemised.
 *
 * The registrar's price is only part of it. The wallet signs ONE permit for the
 * whole funding budget and the commit batch moves it into the HCA, which then
 * pays the registrar from its own balance — so the amount that actually leaves
 * the wallet is `registration + networkFee`.
 *
 * Gating on the price alone (which the token picker still does) let wallets
 * holding between the price and the budget clear checkout and then fail the
 * commit simulation with an unclassifiable revert. See
 * `packages/smart-account/DEBUGGING_INTENTS.md` §8.
 */
export interface RegistrationFunding {
  /** The registrar's charge for the name. */
  readonly registration: number
  /** Execution cost of the commit + register legs, funded up front. */
  readonly networkFee: number
  /** `registration + networkFee` — what the registration costs in total. */
  readonly total: number
  /**
   * What the WALLET is actually debited: `total - hcaBalance`, floored at zero.
   *
   * The permit tops the HCA up to the budget rather than re-funding it, so an
   * HCA still holding USDC from a prior registration covers part of the cost
   * itself. Gating on `total` here would block a wallet that only has to cover
   * the shortfall. Equals `total` in the common case of an empty HCA.
   */
  readonly walletDebit: number
  /**
   * What the HCA's standing balance covers: `total - walletDebit`, so
   * `walletDebit + hcaCredit === total` always holds. Zero in the common case
   * of an empty HCA. Exists so user-facing copy can reconcile the debit with
   * the itemised total instead of quoting figures that do not add up.
   */
  readonly hcaCredit: number
  /** The wallet's balance, or `null` when it could not be read. */
  readonly walletBalance: number | null
  /**
   * True only when the balance is KNOWN to be short of {@link walletDebit}. An
   * unreadable balance is not treated as insufficient — the machine re-checks
   * before signing the permit, so a failed read must not block a wallet that
   * can in fact pay.
   */
  readonly isUnderfunded: boolean
}

/**
 * Derive the funding breakdown from a quoted budget.
 *
 * Returns `null` when no budget has been quoted yet (or the quote failed), in
 * which case callers should show the price alone rather than block: a flaky
 * orchestrator is not evidence the user cannot pay.
 */
export function computeRegistrationFunding(params: {
  readonly budget:
    | Pick<HcaBudgetBreakdown, 'total' | 'registrationPrice'>
    | undefined
  readonly walletBalanceRaw: bigint | null
  /**
   * The HCA's standing USDC balance. Defaults to `0n` ("HCA holds nothing"),
   * which gates on the whole budget — the conservative direction when the
   * balance is unknown.
   */
  readonly hcaBalanceRaw?: bigint
  readonly decimals: number
}): RegistrationFunding | null {
  const { budget, walletBalanceRaw, hcaBalanceRaw = 0n, decimals } = params
  if (!budget) return null

  // The permit tops the HCA up rather than re-funding it, so the wallet only
  // covers the shortfall. Floored at zero: an HCA already holding more than the
  // budget needs nothing from the wallet.
  const walletDebitRaw =
    budget.total > hcaBalanceRaw ? budget.total - hcaBalanceRaw : 0n

  // Derived as `total - walletDebit` in RAW units so the two always reconstruct
  // the total exactly. Equals `min(total, hcaBalance)`: an HCA holding more than
  // the budget credits only what the budget actually needs.
  const hcaCreditRaw = budget.total - walletDebitRaw

  // Clamp: a quote that priced the legs at nothing would otherwise render a
  // negative fee line if the price component ever exceeded the total.
  const feeRaw =
    budget.total > budget.registrationPrice
      ? budget.total - budget.registrationPrice
      : 0n

  return {
    registration: decimalBigintToNumber(budget.registrationPrice, decimals),
    networkFee: decimalBigintToNumber(feeRaw, decimals),
    total: decimalBigintToNumber(budget.total, decimals),
    walletDebit: decimalBigintToNumber(walletDebitRaw, decimals),
    hcaCredit: decimalBigintToNumber(hcaCreditRaw, decimals),
    walletBalance:
      walletBalanceRaw === null
        ? null
        : decimalBigintToNumber(walletBalanceRaw, decimals),
    isUnderfunded:
      walletBalanceRaw !== null && walletBalanceRaw < walletDebitRaw,
  }
}
