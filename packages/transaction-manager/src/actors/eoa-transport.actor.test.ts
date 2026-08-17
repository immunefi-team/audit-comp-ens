import { type Address, getAddress, type WalletClient } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SignerAddressMismatchError,
  TransactionSubmissionError,
} from '../errors/transaction.errors'
import type { EOASigner } from '../types/signer.types'
import type { EOATransactionRequest } from '../types/transaction.types'
import { submitEOATransaction } from './eoa-transport.actor'

// Mock the viem action behind safeSendTransaction so the happy path resolves
// without a real network/wallet.
const sendTransaction = vi.fn()
vi.mock('viem/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/actions')>()
  return {
    ...actual,
    sendTransaction: (...args: unknown[]) => sendTransaction(...args),
  }
})

const ACCOUNT = getAddress('0x000000000000000000000000000000000000aaaa')
const OTHER = getAddress('0x000000000000000000000000000000000000bbbb')
const TO = getAddress('0x000000000000000000000000000000000000cccc')

function eoaSigner(accountAddress: Address | undefined): EOASigner {
  return {
    type: 'eoa',
    walletClient: {
      chain: null,
      account: accountAddress ? { address: accountAddress } : undefined,
    } as unknown as WalletClient,
  }
}

function eoaRequest(from: Address): EOATransactionRequest {
  return {
    type: 'eoa',
    from,
    to: TO,
    chainId: 11155111,
    value: 0n,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('submitEOATransaction', () => {
  it('submits when request.from matches the wallet account', async () => {
    sendTransaction.mockResolvedValueOnce('0xhash')

    const result = await submitEOATransaction({
      request: eoaRequest(ACCOUNT),
      signer: eoaSigner(ACCOUNT),
    })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('0xhash')
    expect(sendTransaction).toHaveBeenCalledOnce()
  })

  it('matches checksummed request.from vs lowercase wallet account', async () => {
    sendTransaction.mockResolvedValueOnce('0xhash')

    const result = await submitEOATransaction({
      request: eoaRequest(ACCOUNT),
      signer: eoaSigner(ACCOUNT.toLowerCase() as Address),
    })

    expect(result.isOk()).toBe(true)
    expect(sendTransaction).toHaveBeenCalledOnce()
  })

  it('returns SignerAddressMismatchError when from != wallet account', async () => {
    const result = await submitEOATransaction({
      request: eoaRequest(OTHER),
      signer: eoaSigner(ACCOUNT),
    })

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(SignerAddressMismatchError)
    expect((error as SignerAddressMismatchError).expected).toBe(OTHER)
    expect((error as SignerAddressMismatchError).actual).toBe(ACCOUNT)
    // Fail closed BEFORE prompting the wallet.
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('returns SignerAddressMismatchError when wallet has no connected account', async () => {
    const result = await submitEOATransaction({
      request: eoaRequest(ACCOUNT),
      signer: eoaSigner(undefined),
    })

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(SignerAddressMismatchError)
    expect((error as SignerAddressMismatchError).actual).toBeUndefined()
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('wraps a send failure in TransactionSubmissionError (matched account)', async () => {
    sendTransaction.mockRejectedValueOnce(new Error('boom'))

    const result = await submitEOATransaction({
      request: eoaRequest(ACCOUNT),
      signer: eoaSigner(ACCOUNT),
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(TransactionSubmissionError)
  })
})
