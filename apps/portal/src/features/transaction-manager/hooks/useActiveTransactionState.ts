import {
  type TransactionMachineState,
  useActiveTransactions,
} from '@ens-apps/transaction-manager'
import { useSyncExternalStore } from 'react'

export type ActiveTransactionState = {
  readonly txId: string
  readonly machineState: TransactionMachineState
  readonly hash: string | undefined
  readonly error: Error | undefined
}

const IN_FLIGHT_STATES: ReadonlySet<string> = new Set([
  'preparing',
  'submitting',
  'pending',
  'confirming',
  'retrying',
  'checkingFallback',
])

/**
 * True when the transaction is in a non-terminal state (still moving toward
 * success/error). Used to gate "open existing modal" vs "start a fresh flow"
 * — a stale terminal-state transaction should not block a new flow.
 */
export const isTransactionInFlight = (
  state: ActiveTransactionState | undefined,
) =>
  !!state &&
  typeof state.machineState === 'string' &&
  IN_FLIGHT_STATES.has(state.machineState)

/**
 * Derives the state of the most recent active transaction from the transaction
 * manager. Subscribes to the active actor so state transitions (pending →
 * success / error) trigger a re-render — the transactions Map itself only
 * notifies on add/remove.
 */
export function useActiveTransactionState():
  | ActiveTransactionState
  | undefined {
  const transactions = useActiveTransactions()

  const entries = Array.from(transactions.entries())
  const lastEntry = entries[entries.length - 1]
  const [txId, actor] = lastEntry ?? []

  const snapshot = useSyncExternalStore(
    (onChange) => {
      if (!actor) return () => {}
      const sub = actor.subscribe(() => onChange())
      return () => sub.unsubscribe()
    },
    () => (actor ? actor.getSnapshot() : undefined),
    () => undefined,
  )

  if (!actor || !txId || !snapshot) return undefined

  return {
    txId,
    machineState: snapshot.value as TransactionMachineState,
    hash: snapshot.context.hash,
    error: snapshot.context.error,
  }
}
