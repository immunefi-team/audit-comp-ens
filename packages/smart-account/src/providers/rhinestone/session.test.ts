import type { RhinestoneAccount } from '@rhinestone/sdk'
import type { Account, Address, Chain, Hex } from 'viem'
import { decodeFunctionData, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it, vi } from 'vitest'
import {
  getDestinationContracts,
  MAX_REFUND_AMOUNT,
  MAX_REFUND_EXCHANGE_RATE,
  MAX_REFUND_GAS_OVERHEAD,
} from './manifest'
import {
  buildEnableSessionWithRefundCall,
  computeDestinationSessionSalt,
  computeSourceSessionSalt,
  createDestinationSession,
} from './session'

const VALIDATOR = getDestinationContracts(
  sepolia.id,
).hcaOwnerAndSessionValidator

const HCA = '0xaaaa000000000000000000000000000000000001' as const
const RESOLVER = '0x3333333333333333333333333333333333333333' as const
const SESSION_KEY = '0x9999999999999999999999999999999999999999' as const
const REFUND_TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const

describe('computeDestinationSessionSalt', () => {
  it('is deterministic for the same inputs', () => {
    const args = {
      hcaSessionNonce: 0n,
      validUntil: 1_800_000_000n,
      resolver: RESOLVER as Address,
      refundToken: REFUND_TOKEN as Address,
    }
    expect(computeDestinationSessionSalt(args)).toBe(
      computeDestinationSessionSalt(args),
    )
  })

  it('changes when the nonce changes (so a new authorization is required)', () => {
    const base = {
      hcaSessionNonce: 0n,
      validUntil: 1_800_000_000n,
      resolver: RESOLVER as Address,
      refundToken: REFUND_TOKEN as Address,
    }
    expect(computeDestinationSessionSalt(base)).not.toBe(
      computeDestinationSessionSalt({ ...base, hcaSessionNonce: 1n }),
    )
  })

  it('changes when the resolver changes (rebinding needs re-auth)', () => {
    const base = {
      hcaSessionNonce: 0n,
      validUntil: 1_800_000_000n,
      resolver: RESOLVER as Address,
      refundToken: REFUND_TOKEN as Address,
    }
    expect(computeDestinationSessionSalt(base)).not.toBe(
      computeDestinationSessionSalt({
        ...base,
        resolver: '0x4444444444444444444444444444444444444444',
      }),
    )
  })
})

describe('computeSourceSessionSalt', () => {
  it('is deterministic and sensitive to maxSourceAmount', () => {
    const base = {
      wallet: '0x1111111111111111111111111111111111111111' as Address,
      validUntil: 1_800_000_000n,
      sourceToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
      hca: HCA as Address,
      destinationToken: REFUND_TOKEN as Address,
      destinationChainId: 11155111n,
      maxSourceAmount: 20_000_000n,
      maxDestinationAmount: 14_000_000n,
    }
    expect(computeSourceSessionSalt(base)).toBe(computeSourceSessionSalt(base))
    expect(computeSourceSessionSalt(base)).not.toBe(
      computeSourceSessionSalt({ ...base, maxSourceAmount: 21_000_000n }),
    )
  })
})

describe('buildEnableSessionWithRefundCall', () => {
  const abi = parseAbi([
    'function enableSessionWithRefund(bytes32 permissionId, address sessionKey, uint48 validUntil, address resolver, address refundToken, uint96 maxRefundExchangeRate, uint48 maxRefundGasOverhead, uint96 maxRefundAmount)',
  ])

  it('encodes exact arg order with value 0', () => {
    const call = buildEnableSessionWithRefundCall({
      chainId: sepolia.id,
      permissionId: `0x${'2'.repeat(64)}` as Hex,
      sessionKey: SESSION_KEY,
      validUntil: 1_800_000_000n,
      resolver: RESOLVER,
    })
    expect(call.value).toBe(0n)
    const decoded = decodeFunctionData({ abi, data: call.data })
    expect(decoded.functionName).toBe('enableSessionWithRefund')
    const args = decoded.args as readonly [
      Hex,
      Address,
      number,
      Address,
      Address,
      bigint,
      number,
      bigint,
    ]
    expect(args[1].toLowerCase()).toBe(SESSION_KEY.toLowerCase())
    expect(args[2]).toBe(1_800_000_000)
    expect(args[3].toLowerCase()).toBe(RESOLVER.toLowerCase())
    expect(args[5]).toBe(MAX_REFUND_EXCHANGE_RATE)
    expect(args[6]).toBe(Number(MAX_REFUND_GAS_OVERHEAD))
    expect(args[7]).toBe(MAX_REFUND_AMOUNT)
  })

  it('targets the standalone validator', () => {
    const call = buildEnableSessionWithRefundCall({
      chainId: sepolia.id,
      permissionId: `0x${'2'.repeat(64)}` as Hex,
      sessionKey: SESSION_KEY,
      validUntil: 1_800_000_000n,
      resolver: RESOLVER,
    })
    expect(call.to.toLowerCase()).toBe(VALIDATOR.toLowerCase())
  })
})

describe('createDestinationSession', () => {
  function mockAccount() {
    const experimental_getSessionDetails = vi.fn().mockResolvedValue({
      nonces: [0n],
      hashesAndChainIds: [
        { chainId: 11155111n, sessionDigest: `0x${'5'.repeat(64)}` },
      ],
      data: { message: { sessionsAndChainIds: [] } },
    })
    const experimental_signEnableSession = vi
      .fn()
      .mockResolvedValue(`0x${'ab'.repeat(65)}`)
    return {
      account: {
        experimental_getSessionDetails,
        experimental_signEnableSession,
      } as unknown as RhinestoneAccount,
      experimental_getSessionDetails,
      experimental_signEnableSession,
    }
  }

  const publicClient = {
    readContract: vi.fn().mockResolvedValue([HCA, 0n]),
  } as never

  const sessionAccount = { address: SESSION_KEY } as unknown as Account

  it('signs ONE authorization and returns destination enable-data (index 0)', async () => {
    const { account, experimental_signEnableSession } = mockAccount()
    const result = await createDestinationSession({
      rhinestoneAccount: account,
      publicClient,
      chain: sepolia as Chain,
      hca: HCA,
      resolver: RESOLVER,
      sessionAccount,
      validUntil: 1_800_000_000n,
      alreadyDeployed: false,
    })
    expect(result.isOk()).toBe(true)
    expect(experimental_signEnableSession).toHaveBeenCalledTimes(1)
    const value = result._unsafeUnwrap()
    expect(value.enableData.sessionToEnableIndex).toBe(0)
    expect(value.enableData.hcaSessionNonce).toBe(0n)
    expect(value.enableData.userSignature).toMatch(/^0x[0-9a-f]+$/)
    expect(value.session.account?.toLowerCase()).toBe(HCA.toLowerCase())
  })

  it('surfaces a tagged SessionEnableError when signing fails', async () => {
    const { account, experimental_signEnableSession } = mockAccount()
    experimental_signEnableSession.mockRejectedValueOnce(
      new Error('user rejected'),
    )
    const result = await createDestinationSession({
      rhinestoneAccount: account,
      publicClient,
      chain: sepolia as Chain,
      hca: HCA,
      resolver: RESOLVER,
      sessionAccount,
      validUntil: 1_800_000_000n,
      alreadyDeployed: false,
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()._tag).toBe('SessionEnableError')
  })
})
