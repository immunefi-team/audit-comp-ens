import { fromAsyncThrowable } from 'neverthrow'
import { type SendTransactionErrorType, sendTransaction } from 'viem/actions'

export const safeSendTransaction = fromAsyncThrowable(
  sendTransaction,
  (error) => error as SendTransactionErrorType,
)
