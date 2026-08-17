/**
 * Warp Transport Actor Tests
 *
 * Tests for submitWarpTransaction — the Warp intent-based transport.
 */

import type { RhinestoneAccount } from '@rhinestone/sdk'
import type { Address, Hash, Hex } from 'viem'
import { sepolia } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionSubmissionError } from '../errors/transaction.errors'
import type { RhinestoneSigner } from '../types/signer.types'
import type {
  EOATransactionRequest,
  RhinestoneTransactionRequest,
} from '../types/transaction.types'
import { submitWarpTransaction } from './warp-transport.actor'

// ── Fixtures ───────────────────────────────────────────────────────────

const MOCK_TX_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash

const MOCK_CALLS = [
  {
    to: '0xTarget12345678901234567890123456789012345678' as Address,
    data: '0xdeadbeef' as Hex,
    value: 0n,
  },
]

/** Scoped SmartSession object the SDK signs Intents with. */
const MOCK_SESSION = {
  owners: {
    type: 'ecdsa',
    accounts: [{ address: '0x5555555555555555555555555555555555555555' }],
  },
} as unknown as NonNullable<RhinestoneSigner['session']>['session']

function createMockSigner(): RhinestoneSigner {
  return {
    type: 'rhinestone',
    account: {
      sendTransaction: vi.fn().mockResolvedValue('mock-intent-id'),
      sendUserOperation: vi.fn().mockResolvedValue('mock-userop-result'),
      waitForExecution: vi.fn().mockImplementation((result: unknown) => {
        // Return different shapes based on which method was called
        if (result === 'mock-userop-result') {
          return { receipt: { transactionHash: MOCK_TX_HASH } }
        }
        return { fill: { hash: MOCK_TX_HASH } }
      }),
    } as unknown as RhinestoneAccount,
    config: {
      rhinestoneApiKey: 'test-key',
      chain: sepolia,
      defaultInfra: 'warp',
    },
  }
}

function createRhinestoneRequest(
  overrides: Partial<RhinestoneTransactionRequest> = {},
): RhinestoneTransactionRequest {
  return {
    type: 'rhinestone-intent',
    from: '0xFrom1234567890123456789012345678901234' as Address,
    chainId: 11155111,
    rhinestoneParams: {
      calls: MOCK_CALLS,
    },
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('submitWarpTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for non-rhinestone-intent request type', async () => {
    const signer = createMockSigner()
    const request: EOATransactionRequest = {
      type: 'eoa',
      from: '0xFrom1234567890123456789012345678901234' as Address,
      to: '0xTo12345678901234567890123456789012345678' as Address,
      chainId: 11155111,
    }

    const result = await submitWarpTransaction({ request, signer })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
    expect(result._unsafeUnwrapErr().message).toContain(
      'Warp transport requires rhinestone-intent request',
    )
  })

  it('returns error for empty calls array', async () => {
    const signer = createMockSigner()
    const request = createRhinestoneRequest({
      rhinestoneParams: { calls: [] },
    })

    const result = await submitWarpTransaction({ request, signer })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
    expect(result._unsafeUnwrapErr().message).toContain(
      'calls is required and must not be empty',
    )
  })

  it('owner-signed (no session): omits `signers` so the SDK uses the owner validator', async () => {
    const signer = createMockSigner()
    const request = createRhinestoneRequest()

    await submitWarpTransaction({ request, signer })

    expect(signer.account.sendTransaction).toHaveBeenCalledWith({
      sourceChains: [sepolia],
      targetChain: sepolia,
      calls: MOCK_CALLS,
      sponsored: { gas: false, bridging: false, swaps: false },
      feeAsset: 'USDC',
      tokenRequests: [],
    })
    // No active session → `signers` must not be passed.
    expect(signer.account.sendTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ signers: expect.anything() }),
    )
  })

  it('session attached: signs the Intent with the scoped session (experimental_session)', async () => {
    const signer = createMockSigner()
    signer.session = { session: MOCK_SESSION }
    const request = createRhinestoneRequest()

    await submitWarpTransaction({ request, signer })

    expect(signer.account.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        signers: {
          type: 'experimental_session',
          session: MOCK_SESSION,
          verifyExecutions: true,
        },
      }),
    )
  })

  it('attaches enableData only on the request that carries it (first HCA action)', async () => {
    const signer = createMockSigner()
    signer.session = { session: MOCK_SESSION }
    const sessionEnableData = { mode: 'enable' } as never
    const request = createRhinestoneRequest({
      rhinestoneParams: {
        calls: MOCK_CALLS,
        feeAsset: 'USDC',
        sessionEnableData,
      },
    })

    await submitWarpTransaction({ request, signer })

    expect(signer.account.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        signers: {
          type: 'experimental_session',
          session: MOCK_SESSION,
          enableData: sessionEnableData,
          verifyExecutions: true,
        },
        // User-paid standalone-HCA route: no sponsorship, fees in USDC.
        sponsored: { gas: false, bridging: false, swaps: false },
        feeAsset: 'USDC',
      }),
    )
  })

  it('rejects enableData without an active session (it can only ride a session signer)', async () => {
    const signer = createMockSigner()
    const request = createRhinestoneRequest({
      rhinestoneParams: {
        calls: MOCK_CALLS,
        sessionEnableData: { mode: 'enable' } as never,
      },
    })

    const result = await submitWarpTransaction({ request, signer })

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
    expect(result._unsafeUnwrapErr().message).toContain(
      'requires a signer with an active session',
    )
    expect(signer.account.sendTransaction).not.toHaveBeenCalled()
  })

  it('calls waitForExecution and returns receipt.fill.hash', async () => {
    const signer = createMockSigner()
    const request = createRhinestoneRequest()

    const result = await submitWarpTransaction({ request, signer })

    expect(signer.account.waitForExecution).toHaveBeenCalledWith(
      'mock-intent-id',
      false,
    )
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(MOCK_TX_HASH)
  })

  it('always sends the user-paid shape — sponsorship is not requestable', async () => {
    // Gas sponsorship does not exist on this deployment, and there is no
    // caller-facing knob or env flag to turn it on. This used to default to
    // `true` whenever `sponsored` was omitted, so every new call site
    // silently asked for a subsidy no relayer here offers.
    const signer = createMockSigner()
    const request = createRhinestoneRequest({
      rhinestoneParams: { calls: MOCK_CALLS },
    })

    await submitWarpTransaction({ request, signer })

    expect(signer.account.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        sponsored: { gas: false, bridging: false, swaps: false },
        feeAsset: 'USDC',
      }),
    )
  })

  it('returns TransactionSubmissionError on SDK failure', async () => {
    const signer = createMockSigner()
    ;(
      signer.account.sendTransaction as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Network error'))
    const request = createRhinestoneRequest()

    const result = await submitWarpTransaction({ request, signer })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
  })

  it('returns error when no hash in execution receipt', async () => {
    const signer = createMockSigner()
    ;(
      signer.account.waitForExecution as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      fill: { hash: undefined },
    })
    const request = createRhinestoneRequest()

    const result = await submitWarpTransaction({ request, signer })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
    expect(result._unsafeUnwrapErr().message).toContain(
      'No transaction hash returned',
    )
  })
})
