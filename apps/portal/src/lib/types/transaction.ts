import type { Hash } from 'viem'

export interface TransactionStatusProps {
  readonly txHash: Hash | undefined
  readonly isConfirming: boolean
  readonly isConfirmed: boolean
  readonly isReverted: boolean
  readonly txError: unknown | null
  readonly receiptError: unknown | null
}
