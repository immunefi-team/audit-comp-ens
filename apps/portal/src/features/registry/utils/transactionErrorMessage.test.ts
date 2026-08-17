import { describe, expect, it } from 'vitest'
import { getTransactionErrorInfo } from './transactionErrorMessage'

describe('getTransactionErrorInfo', () => {
  it('returns a short message for user rejection errors', () => {
    const message =
      'Transaction Failed\nUser rejected the request. Request Arguments: ... Details: MetaMask Tx Signature: User denied transaction signature.'

    const result = getTransactionErrorInfo({ message })

    expect(result.summary).toBe('Transaction rejected in wallet.')
    expect(result.details).toContain('User rejected the request.')
  })

  it('prefers shortMessage when provided', () => {
    const error = {
      shortMessage: 'User rejected the request.',
      message: 'User rejected the request. Request Arguments: ...',
    }

    const result = getTransactionErrorInfo(error)

    expect(result.summary).toBe('Transaction rejected in wallet.')
    expect(result.details).toContain('User rejected the request.')
  })

  it('maps insufficient funds errors to a friendly message', () => {
    const error = {
      message: 'insufficient funds for gas * price + value (extra details)',
    }

    const result = getTransactionErrorInfo(error)

    expect(result.summary).toBe(
      'Insufficient funds to complete the transaction.',
    )
    expect(result.details).toContain('insufficient funds')
  })

  it('extracts a revert reason when available', () => {
    const error = {
      message:
        'Execution reverted: Registry not found. Request Arguments: ... Docs: https://viem.sh/...',
    }

    const result = getTransactionErrorInfo(error)

    expect(result.summary).toBe('Execution reverted: Registry not found.')
    expect(result.details).toContain('Execution reverted: Registry not found.')
  })

  it('dedupes and caps details, including cause/meta messages', () => {
    const error = {
      message: 'Duplicate message',
      metaMessages: ['Duplicate message', 'Meta detail'],
      cause: { message: 'Duplicate message', details: 'Extra detail' },
    }

    const result = getTransactionErrorInfo(error)

    const details = result.details ?? ''
    expect(details.match(/Duplicate message/g)?.length).toBe(1)
    expect(details).toContain('Meta detail')
    expect(details).toContain('Extra detail')

    const longError = {
      message: 'a'.repeat(4100),
    }
    const longResult = getTransactionErrorInfo(longError)
    expect(longResult.details).toContain('…(truncated)')
  })

  it('handles reason string format', () => {
    const error = {
      message:
        "VM Exception while processing transaction: reason string 'Nope'",
    }

    const result = getTransactionErrorInfo(error)

    expect(result.summary).toBe('Execution reverted: Nope.')
  })
})
