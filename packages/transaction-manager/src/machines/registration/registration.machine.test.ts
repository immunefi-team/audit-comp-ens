import type { Address, PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import type { Signer } from '../../types/signer.types'
import type { HcaSessionEnableParams } from './registration.hca.actors'
import { submitFundingAndCommitActor } from './registration.hca.actors'
import { registrationMachine } from './registration.machine'

const HCA = '0xaaaa000000000000000000000000000000000001' as Address
const WALLET = '0x1111111111111111111111111111111111111111' as Address
const BUDGET = 15_000_000n

const permit = {
  owner: WALLET,
  spender: HCA,
  value: BUDGET,
  deadline: 1_800_000_000n,
  v: 27,
  r: `0x${'11'.repeat(32)}`,
  s: `0x${'22'.repeat(32)}`,
} as const

/**
 * Stand-in for the stored session-enable proof. The owner signs the session
 * authorization once; this payload is rebuilt from storage on every run.
 */
const SESSION_ENABLE = {
  enableData: { stub: 'enable-data' },
  permissionId: `0x${'33'.repeat(32)}`,
  sessionKey: '0x2222222222222222222222222222222222222222',
  validUntil: 2_000_000_000n,
} as unknown as HcaSessionEnableParams

/**
 * Stub only the standalone-HCA actors the funding path walks through. Anything
 * further down the flow (commitment polling, reveal) never starts because the
 * assertions stop at the funding decision.
 */
const startHcaRegistration = (overrides: {
  /** HCA USDC balance per `checkingHcaFunding` visit (last value repeats). */
  balances?: bigint[]
  signFundingPermit?: ReturnType<typeof vi.fn>
  submitFundingAndCommit?: ReturnType<typeof vi.fn>
  /** Overrides the balance stub entirely (e.g. to simulate an RPC failure). */
  readHcaUsdcBalance?: ReturnType<typeof vi.fn>
  estimateHcaBudget?: ReturnType<typeof vi.fn>
  hcaBudget?: bigint
  /** Stored session-enable proof, as rebuilt from storage on every run. */
  hcaSessionEnable?: HcaSessionEnableParams
}) => {
  const estimateHcaBudget =
    overrides.estimateHcaBudget ??
    vi.fn(async () => ({
      total: BUDGET,
      commitCost: 4_000_000n,
      registerCost: 6_000_000n,
      registrationPrice: 5_000_000n,
      source: 'quote' as const,
    }))
  const signFundingPermit =
    overrides.signFundingPermit ?? vi.fn(async () => permit)
  const submitFundingAndCommit =
    overrides.submitFundingAndCommit ??
    vi.fn(() => new Promise(() => {})) /* park: assertions stop here */

  const balances = overrides.balances ?? [0n]
  let fundingChecks = 0

  const actor = createActor(
    registrationMachine.provide({
      actors: {
        estimateHcaBudget: fromPromise(estimateHcaBudget) as never,
        readHcaUsdcBalance: fromPromise(
          overrides.readHcaUsdcBalance ??
            (async () => {
              const balance =
                balances[Math.min(fundingChecks, balances.length - 1)] ?? 0n
              fundingChecks += 1
              return balance
            }),
        ) as never,
        signFundingPermit: fromPromise(signFundingPermit) as never,
        submitFundingAndCommit: fromPromise(submitFundingAndCommit) as never,
      },
    }),
    { input: { chainId: sepolia.id } },
  )

  actor.start()
  actor.send({
    type: 'START_REGISTRATION',
    name: 'myname.eth',
    duration: 31_536_000n,
    token: 'USDC',
    price: 5_000_000n,
    signer: { type: 'rhinestone' } as unknown as Signer,
    accountAddress: HCA,
    ownerAddress: WALLET,
    publicClient: { chain: sepolia } as unknown as PublicClient,
    hcaSessionEnable: overrides.hcaSessionEnable ?? SESSION_ENABLE,
    ...(overrides.hcaBudget !== undefined
      ? { hcaBudget: overrides.hcaBudget }
      : {}),
  })

  return { actor, estimateHcaBudget, signFundingPermit, submitFundingAndCommit }
}

describe('registrationMachine — standalone-HCA funding', () => {
  it('skips the funding permit when the HCA already covers the budget', async () => {
    const { actor, signFundingPermit } = startHcaRegistration({
      balances: [BUDGET],
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    // Leftover budget from a prior registration ⇒ zero extra wallet prompts.
    expect(signFundingPermit).not.toHaveBeenCalled()
    expect(actor.getSnapshot().context.permit).toBeUndefined()
  })

  it('signs a funding permit for the SHORTFALL, not the whole budget', async () => {
    // The HCA keeps unspent budget from prior registrations. Permitting the
    // full budget on top of that leftover re-funds it every run and ratchets
    // the balance up, so the permit must cover only the difference.
    const balance = 1_504_912n
    const { actor, signFundingPermit } = startHcaRegistration({
      balances: [balance],
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    expect(signFundingPermit).toHaveBeenCalledOnce()
    expect(signFundingPermit.mock.calls[0][0].input).toMatchObject({
      wallet: WALLET,
      hca: HCA,
      value: BUDGET - balance,
    })
    expect(actor.getSnapshot().context.permit).toEqual(permit)
  })

  it('permits the full budget when the balance read fails', async () => {
    // An unreadable balance must not be guessed at: over-permitting leaves the
    // surplus in the user-owned HCA, whereas assuming funds we could not see
    // risks an under-funded reveal that reverts.
    const { actor, signFundingPermit } = startHcaRegistration({
      readHcaUsdcBalance: vi.fn(async () => {
        throw new Error('rpc down')
      }),
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    expect(signFundingPermit.mock.calls[0][0].input).toMatchObject({
      value: BUDGET,
    })
  })

  it('honours a caller-supplied budget instead of estimating one', async () => {
    const { actor, estimateHcaBudget } = startHcaRegistration({
      hcaBudget: 42_000_000n,
      balances: [42_000_000n],
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    expect(estimateHcaBudget).not.toHaveBeenCalled()
    expect(actor.getSnapshot().context.hcaBudget).toBe(42_000_000n)
  })

  it('discards the signed permit on retry so an expired one is never resubmitted', async () => {
    // The EIP-2612 permit carries a 1-hour deadline; retrying with the stored
    // signature after that window reverts every attempt. The retry must go back
    // through the funding check, which either skips the permit (the HCA was
    // funded by the failed attempt) or signs a fresh one.
    const submitFundingAndCommit = vi
      .fn()
      .mockRejectedValueOnce(new Error('relayer rejected the intent'))
      .mockImplementation(() => new Promise(() => {}))

    // Second visit sees the HCA funded by the attempt that failed afterwards.
    const { actor, signFundingPermit } = startHcaRegistration({
      balances: [BUDGET - 1n, BUDGET],
      submitFundingAndCommit,
    })

    await waitFor(actor, (s) => s.matches('error'))
    expect(actor.getSnapshot().context.permit).toEqual(permit)
    expect(actor.getSnapshot().context.retryTarget).toBe(
      'submittingSetupBundle',
    )

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    // Re-entering the funding check found the HCA funded, so the retry carries
    // no permit at all rather than replaying the expiring signature.
    expect(actor.getSnapshot().context.permit).toBeUndefined()
    expect(signFundingPermit).toHaveBeenCalledOnce()
    // A stale commitment is cleared too, so the reveal can't bind to it.
    expect(actor.getSnapshot().context.commitmentTxId).toBeUndefined()
  })
})

describe('registrationMachine — session-enable proof', () => {
  // The proof is attached to every commit. Omitting it fails two different
  // ways, both masked by the emissary as `InvalidSignature()`:
  //   with a permit    → `ActionNotAllowed(USDC, permit)` (0xde1834f2), since
  //                      `_checkRegistrationExecutions` allows only `approve`
  //                      on the payment token;
  //   without a permit → `InvalidSigner()` (0x815e1d64), since mode 0x02 finds
  //                      `_sessions[hca][permissionId]` empty until the session
  //                      has actually been enabled on-chain.

  it('attaches the enable proof whenever it funds, even on an already-enabled session', async () => {
    const { actor, submitFundingAndCommit } = startHcaRegistration({
      balances: [BUDGET - 1n],
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    const input = submitFundingAndCommit.mock.calls[0][0].input
    expect(input.permit).toEqual(permit)
    // The proof is reusable and the enable call idempotent, so re-presenting it
    // costs no wallet prompt and keeps the batch on the legal policy path.
    expect(input.sessionEnable).toEqual(SESSION_ENABLE)
  })

  it('still attaches the enable proof when the HCA needs no funding', async () => {
    // Regression: gating the proof on "we are funding" broke the FIRST commit
    // under a new session whenever leftover balance covered the budget. With no
    // proof the SDK signs mode 0x02 and `_validateFixedSessionPayload` reverts
    // `InvalidSigner()` because `_sessions[hca][permissionId]` is still empty.
    const { actor, submitFundingAndCommit } = startHcaRegistration({
      balances: [BUDGET],
    })

    await waitFor(actor, (s) => s.matches('submittingSetupBundle'))

    const input = submitFundingAndCommit.mock.calls[0][0].input
    expect(input.permit).toBeUndefined()
    expect(input.sessionEnable).toEqual(SESSION_ENABLE)
  })

  it('rejects a permit with no enable proof instead of submitting it', async () => {
    // Belt-and-braces for the case the machine cannot repair: the HCA is short
    // but no session proof was ever stored. Building this batch guarantees an
    // `InvalidSignature()` from the orchestrator with no usable detail, so the
    // actor refuses it and names the real cause.
    const result = await submitFundingAndCommitActor({
      name: 'myname.eth',
      wallet: WALLET,
      hca: HCA,
      duration: 31_536_000n,
      permit,
      // sessionEnable deliberately omitted
      signer: { type: 'rhinestone' } as unknown as Signer,
      publicClient: { chain: sepolia } as unknown as PublicClient,
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain(
      'ActionNotAllowed(USDC, permit)',
    )
  })
})
