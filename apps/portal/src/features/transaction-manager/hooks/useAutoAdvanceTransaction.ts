import { useEffect, useRef } from 'react'
import type { Transaction } from '../types'

/**
 * Automatically calls `onDone` on the currently active transaction when it
 * succeeds, advancing the flow to the next transaction in the sequence.
 *
 * `transactions` is held in a ref so the effect only fires when
 * `autoAdvanceTxId` changes — callers pass an inline array that gets a new
 * reference on every render, and including it in deps would cause an infinite
 * loop when `onDone` triggers a state update.
 */
export function useAutoAdvanceTransaction(
  autoAdvanceTxId: string | null,
  transactions: readonly Transaction[],
): void {
  const transactionsRef = useRef(transactions)
  transactionsRef.current = transactions

  useEffect(() => {
    if (!autoAdvanceTxId) return

    const txs = transactionsRef.current
    const activeIndex = txs.findIndex((tx) => tx.id === autoAdvanceTxId)
    if (activeIndex < 0 || activeIndex >= txs.length - 1) return

    txs[activeIndex].onDone()
  }, [autoAdvanceTxId])
}
