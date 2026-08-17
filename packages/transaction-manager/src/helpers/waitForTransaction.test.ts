import type { Hash, TransactionReceipt } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTransaction: vi.fn(),
}))

vi.mock('../providers/transactionManager', () => ({
  transactionManager: { getTransaction: mocks.getTransaction },
}))

import {
  waitForTransaction,
  waitForTransactionHash,
} from './waitForTransaction'

const HASH = `0x${'1'.repeat(64)}` as Hash
const REPLACEMENT_HASH = `0x${'2'.repeat(64)}` as Hash
const REPLACEMENT_RECEIPT = {
  transactionHash: REPLACEMENT_HASH,
} as TransactionReceipt

describe('waitForTransactionHash', () => {
  it('returns an already-submitted hash immediately', async () => {
    mocks.getTransaction.mockReturnValueOnce({
      getSnapshot: () => ({ context: { hash: HASH }, value: 'waitForReceipt' }),
    })

    await expect(waitForTransactionHash('tx-1')).resolves.toBe(HASH)
  })

  it('resolves as soon as the transaction actor publishes a hash', async () => {
    let listener:
      | ((snapshot: {
          context: { hash?: Hash }
          value: string | { error: string }
        }) => void)
      | undefined
    const unsubscribe = vi.fn()
    mocks.getTransaction.mockReturnValueOnce({
      getSnapshot: () => ({ context: {}, value: 'submitting' }),
      subscribe: (next: typeof listener) => {
        listener = next
        return { unsubscribe }
      },
    })

    const submitted = waitForTransactionHash('tx-2')
    listener?.({ context: { hash: HASH }, value: 'waitForReceipt' })

    await expect(submitted).resolves.toBe(HASH)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('waitForTransaction', () => {
  it('returns a replacement hash from an already-complete receipt', async () => {
    mocks.getTransaction.mockReturnValueOnce({
      getSnapshot: () => ({
        context: { hash: HASH, receipt: REPLACEMENT_RECEIPT },
        value: 'success',
      }),
    })

    await expect(waitForTransaction('tx-3')).resolves.toEqual({
      hash: REPLACEMENT_HASH,
      receipt: REPLACEMENT_RECEIPT,
    })
  })

  it('returns a replacement hash when the successful snapshot publishes its receipt', async () => {
    type ActorSnapshot = {
      context: {
        hash?: Hash
        receipt?: TransactionReceipt
      }
      value: string | { error: string }
    }
    let listener: ((snapshot: ActorSnapshot) => void) | undefined
    const unsubscribe = vi.fn()
    mocks.getTransaction.mockReturnValueOnce({
      getSnapshot: () => ({ context: { hash: HASH }, value: 'pending' }),
      subscribe: (next: typeof listener) => {
        listener = next
        return { unsubscribe }
      },
    })

    const completed = waitForTransaction('tx-4')
    listener?.({
      context: { hash: HASH, receipt: REPLACEMENT_RECEIPT },
      value: 'success',
    })

    await expect(completed).resolves.toEqual({
      hash: REPLACEMENT_HASH,
      receipt: REPLACEMENT_RECEIPT,
    })
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
