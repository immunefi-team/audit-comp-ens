// biome-ignore-all lint/suspicious/noExplicitAny: test fixtures use loose typing
import { act, renderHook } from '@testing-library/react'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenewItem } from '../types'

// Mocked transaction-manager actors + app singletons. Declared via vi.hoisted so
// the vi.mock factories below can reference them.
const mocks = vi.hoisted(() => ({
  pollTransactionStatusActor: vi.fn(),
  readPaymentTokenAllowanceActor: vi.fn(),
  submitApprovalActor: vi.fn(),
  submitRenewActor: vi.fn(),
  useSmartAccountContext: vi.fn(),
  invalidateQueries: vi.fn(),
}))

vi.mock(
  '@ens-apps/transaction-manager/machines/registration/registration.actors',
  () => ({
    pollTransactionStatusActor: mocks.pollTransactionStatusActor,
    readPaymentTokenAllowanceActor: mocks.readPaymentTokenAllowanceActor,
    submitApprovalActor: mocks.submitApprovalActor,
    submitRenewActor: mocks.submitRenewActor,
  }),
)
vi.mock('@/lib/wagmi', () => ({ publicClient: {} }))
vi.mock('@/utils/router/root-context', () => ({
  getQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))
vi.mock('@/lib/smart-account', () => ({
  useSmartAccountContext: mocks.useSmartAccountContext,
}))

import {
  useBulkRenewSubmit,
  WALLET_REQUIRED_MESSAGE,
} from './useBulkRenewSubmit'

const EOA = '0x2222222222222222222222222222222222222222' as const
const HCA = '0x1111111111111111111111111111111111111111' as const

const walletClient = { account: { address: EOA } }

/** HCA-mode account: still renews from the connected wallet, not the HCA. */
const hcaAccount = {
  signer: { type: 'rhinestone' },
  ownerAddress: EOA,
  accountAddress: HCA,
  walletClient,
} as any
const eoaAccount = {
  signer: { type: 'eoa', walletClient },
  ownerAddress: EOA,
  accountAddress: EOA,
  walletClient,
} as any
const disconnected = {
  signer: null,
  ownerAddress: null,
  accountAddress: null,
  walletClient: null,
} as any

const items = (labels: string[]): RenewItem[] =>
  labels.map((label) => ({ label, duration: 31_557_600n }))

const args = {
  items: items(['one', 'two', 'three']),
  token: 'USDC' as const,
  sumPriceRaw: 3_000_000n,
}

const renewedLabels = () =>
  mocks.submitRenewActor.mock.calls.map((call) => call[0]?.label)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pollTransactionStatusActor.mockReturnValue(okAsync(undefined))
  mocks.readPaymentTokenAllowanceActor.mockReturnValue(okAsync(0n))
  mocks.submitApprovalActor.mockReturnValue(okAsync('approval-tx'))
  mocks.submitRenewActor.mockReturnValue(okAsync('renew-tx'))
  mocks.useSmartAccountContext.mockReturnValue(hcaAccount)
})

describe('useBulkRenewSubmit', () => {
  it('fails fast when no wallet is connected', async () => {
    mocks.useSmartAccountContext.mockReturnValue(disconnected)
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMessage).toBe(WALLET_REQUIRED_MESSAGE)
    expect(mocks.submitRenewActor).not.toHaveBeenCalled()
  })

  it('approves the summed price once, then renews each name in its own tx', async () => {
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    expect(result.current.phase).toBe('success')
    // One approve for the whole batch — the per-name renews share the allowance.
    expect(mocks.submitApprovalActor).toHaveBeenCalledTimes(1)
    expect(mocks.submitApprovalActor.mock.calls[0]?.[0]?.tokenPrice).toBe(
      3_000_000n,
    )
    expect(renewedLabels()).toEqual(['one', 'two', 'three'])
    expect(mocks.invalidateQueries).toHaveBeenCalled()
  })

  it('renews from the connected wallet, never through the HCA', async () => {
    // `AbstractETHRegistrar.renew` charges `msg.sender` with no HCA unwrap, so
    // the EOA must be the sender AND the payer — routing this through the HCA
    // would bill the smart account instead. The signer type IS the guarantee:
    // an EOA request never reaches the intent transport at all.
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    for (const call of mocks.submitRenewActor.mock.calls) {
      expect(call[0]?.signer?.type).toBe('eoa')
    }
    expect(mocks.submitApprovalActor.mock.calls[0]?.[0]?.signer?.type).toBe(
      'eoa',
    )
  })

  it('authorizes against the canonical registrar, not a separate deployment', async () => {
    // Regression guard, inverted from what it used to assert: renewal is NOT an
    // HCA flow, so it must leave the registrar and token to the actors' own
    // canonical defaults. Overriding them with the standalone-HCA deployment
    // approved -- and renewed on -- a registrar that had never registered the
    // name, which reverts `NameNotRenewable(label)`.
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    for (const mock of [
      mocks.readPaymentTokenAllowanceActor,
      mocks.submitApprovalActor,
    ]) {
      const arg = mock.mock.calls[0]?.[0]
      expect(arg?.registrarAddress).toBeUndefined()
      expect(arg?.paymentTokenAddress).toBeUndefined()
    }
  })

  it('reads the allowance for the connected wallet, not the HCA', async () => {
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    expect(mocks.readPaymentTokenAllowanceActor.mock.calls[0]?.[0]?.owner).toBe(
      EOA,
    )
  })

  it('works in EOA mode', async () => {
    // Previously refused outright: the atomic-batch model required a smart
    // account. The direct-wallet route has no such constraint.
    mocks.useSmartAccountContext.mockReturnValue(eoaAccount)
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    expect(result.current.phase).toBe('success')
    expect(renewedLabels()).toEqual(['one', 'two', 'three'])
  })

  it('skips approval when the allowance already covers the batch', async () => {
    mocks.readPaymentTokenAllowanceActor.mockReturnValue(okAsync(9_999_999n))
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })

    expect(mocks.submitApprovalActor).not.toHaveBeenCalled()
    expect(renewedLabels()).toEqual(['one', 'two', 'three'])
  })

  it('resumes from the first failure instead of re-paying for renewed names', async () => {
    // Sequential renewals are NOT atomic: names before the failure really did
    // renew on-chain, so a retry must skip them.
    mocks.readPaymentTokenAllowanceActor.mockReturnValue(okAsync(9_999_999n))
    mocks.submitRenewActor
      .mockReturnValueOnce(okAsync('renew-one'))
      .mockReturnValueOnce(errAsync(new Error('boom')))
    const { result } = renderHook(() => useBulkRenewSubmit())

    await act(async () => {
      await result.current.submit(args)
    })
    expect(result.current.phase).toBe('error')
    expect(result.current.statuses.one).toBe('done')
    expect(renewedLabels()).toEqual(['one', 'two'])

    await act(async () => {
      await result.current.submit(args)
    })
    expect(result.current.phase).toBe('success')
    // 'one' is not renewed (or paid for) a second time.
    expect(renewedLabels()).toEqual(['one', 'two', 'two', 'three'])
  })

  it('ignores a stale submission after the dialog is reset mid-flight', async () => {
    mocks.readPaymentTokenAllowanceActor.mockReturnValue(okAsync(9_999_999n))
    // Gate the first renewal's confirmation so we can reset while it's in-flight.
    let releaseRenew: () => void = () => {}
    mocks.pollTransactionStatusActor.mockReturnValue(
      ResultAsync.fromSafePromise(
        new Promise<void>((resolve) => {
          releaseRenew = resolve
        }),
      ),
    )
    const { result } = renderHook(() => useBulkRenewSubmit())

    let submitPromise!: Promise<void>
    await act(async () => {
      submitPromise = result.current.submit(args)
      // Flush pre-renew microtasks so we park at the gated confirmation.
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })
    expect(result.current.phase).toBe('renewing')

    // User closes and reopens the dialog — its effect calls reset().
    act(() => {
      result.current.reset()
    })
    expect(result.current.phase).toBe('idle')

    // The in-flight renewal now confirms; it must NOT flip the reset dialog to
    // 'success' — the run is stale.
    await act(async () => {
      releaseRenew()
      await submitPromise
    })
    expect(result.current.phase).toBe('idle')
  })

  it('reset() clears status and returns to idle', async () => {
    const { result } = renderHook(() => useBulkRenewSubmit())
    await act(async () => {
      await result.current.submit(args)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.statuses).toEqual({})
  })
})
