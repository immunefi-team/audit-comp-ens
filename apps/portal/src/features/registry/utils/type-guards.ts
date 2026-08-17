import type { Hash, TransactionReceipt } from 'viem'

/**
 * Type guard to check if a value is a valid Hash.
 */
export function isHash(value: unknown): value is Hash {
  return typeof value === 'string' && value.startsWith('0x')
}

/**
 * Type guard to check if a value is a TransactionReceipt.
 */
export function isTransactionReceipt(
  value: unknown,
): value is TransactionReceipt {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'blockHash' in value
  )
}

/**
 * Type guard to check if a value is an Error.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}
