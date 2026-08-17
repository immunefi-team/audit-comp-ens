import { ethRegistrarRenewSnippet } from '@ensdomains/ensjs-abi/v2/ethRegistrar'
import type { Address, PublicClient, WalletClient } from 'viem'
import { decodeFunctionData, erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ENS_SEPOLIA_CONTRACTS,
  REFERER_ADDRESS,
  TOKENS,
} from '../../contracts/ens-sepolia'
import type { EOASigner } from '../../types/signer.types'
import type { EoaTransactionRequest } from '../../types/transaction.types'
import { submitApprovalActor, submitRenewActor } from './registration.actors'

const mocks = vi.hoisted(() => ({
  assertPaymentTokenSupported: vi.fn().mockResolvedValue(undefined),
  startTransaction: vi.fn(() => 'tx-1'),
}))

vi.mock('../../contracts/paymentToken', () => ({
  assertPaymentTokenSupported: mocks.assertPaymentTokenSupported,
}))

vi.mock('../../providers/transactionManager', () => ({
  transactionManager: {
    startTransaction: mocks.startTransaction,
  },
}))

const WALLET = '0x1111111111111111111111111111111111111111' as Address
const V1_RENEWER = ENS_SEPOLIA_CONTRACTS.ETHRenewerV1
const signer = {
  type: 'eoa',
  walletClient: { account: { address: WALLET } } as WalletClient,
} satisfies EOASigner
const publicClient = { chain: sepolia } as PublicClient

const submittedRequest = (): EoaTransactionRequest => {
  const [intent] = mocks.startTransaction.mock.calls.at(-1) as unknown as [
    { request: EoaTransactionRequest },
  ]
  return intent.request
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('V1 renewal actors', () => {
  it('approves the V1 renewer as the USDC spender', async () => {
    const result = await submitApprovalActor({
      tokenPrice: 1_000_000n,
      selectedToken: 'USDC',
      signer,
      publicClient,
      registrarAddress: V1_RENEWER,
    })

    expect(result.isOk()).toBe(true)
    const request = submittedRequest()
    const decoded = decodeFunctionData({ abi: erc20Abi, data: request.data })

    expect(request.to).toBe(TOKENS.USDC.address.toLowerCase())
    expect(decoded.functionName).toBe('approve')
    expect(decoded.args).toEqual([V1_RENEWER, 1_100_000n])
  })

  it('targets ETHRenewerV1 with the shared flat renewal calldata', async () => {
    const result = await submitRenewActor({
      label: 'alice.eth',
      duration: 31_536_000n,
      selectedToken: 'USDC',
      signer,
      publicClient,
      renewerAddress: V1_RENEWER,
    })

    expect(result.isOk()).toBe(true)
    expect(mocks.assertPaymentTokenSupported).toHaveBeenCalledWith(
      publicClient,
      V1_RENEWER,
      TOKENS.USDC.address.toLowerCase(),
    )

    const request = submittedRequest()
    const decoded = decodeFunctionData({
      abi: ethRegistrarRenewSnippet,
      data: request.data,
    })

    expect(request.to).toBe(V1_RENEWER)
    expect(decoded.functionName).toBe('renew')
    expect(decoded.args).toEqual([
      'alice',
      31_536_000n,
      TOKENS.USDC.address,
      REFERER_ADDRESS,
    ])
  })

  it('keeps the V2 registrar as the default renewal target', async () => {
    await submitRenewActor({
      label: 'alice',
      duration: 1n,
      selectedToken: 'USDC',
      signer,
      publicClient,
    })

    expect(submittedRequest().to).toBe(ENS_SEPOLIA_CONTRACTS.ETHRegistrar)
  })
})
