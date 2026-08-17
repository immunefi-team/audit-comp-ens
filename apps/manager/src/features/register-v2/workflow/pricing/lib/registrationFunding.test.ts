import { describe, expect, it } from 'vitest'
import { computeRegistrationFunding } from './registrationFunding'

const USDC = 6

/** The live failure this gate was built for: 20.000000 held, 20.196054 needed. */
const PRODUCTION_FAILURE = {
  total: 20_196_054n,
  registrationPrice: 8_000_021n,
}

describe('computeRegistrationFunding', () => {
  it('splits the budget into the rent and the network fee', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 50_000_000n,
      decimals: USDC,
    })

    expect(funding?.registration).toBe(8.000021)
    expect(funding?.networkFee).toBe(12.196033)
    expect(funding?.total).toBe(20.196054)
    // The fee is the remainder, so the parts must reconstruct the debit exactly.
    expect(
      (funding?.registration ?? 0) + (funding?.networkFee ?? 0),
    ).toBeCloseTo(funding?.total ?? 0, 6)
  })

  it('flags the wallet that covers the price but not the budget', () => {
    // Exactly the production case: 20 USDC against an 8 USDC name. The token
    // picker sees 20 > 8 and lets it through; the budget is what it fails on.
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.isUnderfunded).toBe(true)
    expect(funding?.walletBalance).toBe(20)
    expect(funding?.registration).toBeLessThan(funding?.walletBalance ?? 0)
  })

  it('allows a wallet holding exactly the budget', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 20_196_054n,
      decimals: USDC,
    })

    expect(funding?.isUnderfunded).toBe(false)
  })

  it('does not block when the balance could not be read', () => {
    // The machine re-checks before signing the permit. Treating an unreadable
    // balance as insufficient would strand a wallet that can actually pay.
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: null,
      decimals: USDC,
    })

    expect(funding?.isUnderfunded).toBe(false)
    expect(funding?.walletBalance).toBeNull()
  })

  it('debits the wallet only the shortfall when the HCA is part-funded', () => {
    // An HCA holding 20.00 from a prior registration against a 20.196054
    // budget: the permit is signed for the 0.196054 difference, so a wallet
    // holding 1 USDC can pay even though it is far short of the budget.
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 1_000_000n,
      hcaBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.walletDebit).toBe(0.196054)
    expect(funding?.isUnderfunded).toBe(false)
    // The registration still COSTS the full budget — only the debit shrinks.
    expect(funding?.total).toBe(20.196054)
  })

  it('still blocks when the wallet cannot cover even the shortfall', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 100_000n, // 0.10 < 0.196054
      hcaBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.isUnderfunded).toBe(true)
  })

  it('credits the HCA balance so the debit and credit reconstruct the total', () => {
    // The error copy itemises the debit against the credit, so the two have to
    // add up to the total exactly — quoting a debit next to a breakdown that
    // sums to something else prints two figures for the same quantity.
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 100_000n,
      hcaBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.hcaCredit).toBe(20)
    expect((funding?.walletDebit ?? 0) + (funding?.hcaCredit ?? 0)).toBeCloseTo(
      funding?.total ?? 0,
      6,
    )
  })

  it('credits only what the budget needs when the HCA holds more', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 0n,
      hcaBalanceRaw: 500_000_000n,
      decimals: USDC,
    })

    // Not the full 500 the HCA holds — the credit is capped at the budget so
    // it still reconstructs the total alongside a zero debit.
    expect(funding?.hcaCredit).toBe(20.196054)
    expect(funding?.walletDebit).toBe(0)
  })

  it('credits nothing when the HCA is empty', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 50_000_000n,
      decimals: USDC,
    })

    // The common case: the itemised `registration + networkFee` breakdown is
    // only correct copy when there is no credit to account for.
    expect(funding?.hcaCredit).toBe(0)
    expect(funding?.walletDebit).toBe(funding?.total)
  })

  it('asks nothing of the wallet when the HCA already covers the budget', () => {
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 0n,
      hcaBalanceRaw: 25_000_000n,
      decimals: USDC,
    })

    // Floored at zero rather than going negative.
    expect(funding?.walletDebit).toBe(0)
    expect(funding?.isUnderfunded).toBe(false)
  })

  it('gates on the whole budget when the HCA balance is unknown', () => {
    // A failed balance read defaults to 0n — the conservative direction, since
    // over-crediting the HCA would wave through a failing commit simulation.
    const funding = computeRegistrationFunding({
      budget: PRODUCTION_FAILURE,
      walletBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.walletDebit).toBe(20.196054)
    expect(funding?.isUnderfunded).toBe(true)
  })

  it('returns null when no budget has been quoted', () => {
    // A flaky orchestrator must fall back to showing the price, not to a block.
    expect(
      computeRegistrationFunding({
        budget: undefined,
        walletBalanceRaw: 20_000_000n,
        decimals: USDC,
      }),
    ).toBeNull()
  })

  it('never renders a negative fee when the quote prices the legs at zero', () => {
    const funding = computeRegistrationFunding({
      budget: { total: 8_000_021n, registrationPrice: 8_000_021n },
      walletBalanceRaw: 20_000_000n,
      decimals: USDC,
    })

    expect(funding?.networkFee).toBe(0)
    expect(funding?.isUnderfunded).toBe(false)
  })
})
