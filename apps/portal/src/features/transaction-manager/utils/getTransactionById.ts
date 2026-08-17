import type { Transaction } from '../types'

export const getTransactionById = (
  transactions: readonly Transaction[],
  transactionId: string,
): Transaction => {
  const tx = transactions.find(
    (transaction) => transaction.id === transactionId,
  )

  if (!tx) {
    throw new Error(`Transaction with id ${transactionId} not found`)
  }

  return tx
}
