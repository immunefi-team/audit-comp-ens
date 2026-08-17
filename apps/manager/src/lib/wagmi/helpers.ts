import { TaggedError } from '@ens-apps/utils/neverthrow'
import {
  type GetConnectorClientErrorType,
  getConnectorClient,
  type SendTransactionErrorType,
  sendTransaction,
  type WaitForTransactionReceiptErrorType,
  waitForTransactionReceipt,
} from '@wagmi/core'
import { fromAsyncThrowable, fromThrowable } from 'neverthrow'
import type { Client, CreateClientErrorType, Transport } from 'viem'
import { type sepoliaWithEns, wagmiConfig } from '../wagmi'

export class WagmiClientError extends TaggedError('Wagmi/ClientError')<{
  cause: CreateClientErrorType
}> {}

export const safeGetClient = fromThrowable(
  () => wagmiConfig.getClient() as Client<Transport, typeof sepoliaWithEns>,
  (e) => new WagmiClientError({ cause: e as CreateClientErrorType }),
)

export class WagmiConnectorClientError extends TaggedError(
  'Wagmi/ConnectorClientError',
)<{
  cause: GetConnectorClientErrorType
}> {}

export const safeGetConnectorClient = fromAsyncThrowable(
  getConnectorClient,
  (e) =>
    new WagmiConnectorClientError({ cause: e as GetConnectorClientErrorType }),
)

export class WagmiSendTransactionError extends TaggedError(
  'Wagmi/SendTransactionError',
)<{
  cause: SendTransactionErrorType
}> {}

export const safeSendTransaction = fromAsyncThrowable(
  sendTransaction,
  (e) =>
    new WagmiSendTransactionError({ cause: e as SendTransactionErrorType }),
)

export class WagmiWaitForTransactionReceiptError extends TaggedError(
  'Wagmi/WaitForTransactionReceiptError',
)<{
  cause: WaitForTransactionReceiptErrorType
}> {}

export const safeWaitForTransactionReceipt = fromAsyncThrowable(
  waitForTransactionReceipt,
  (e) =>
    new WagmiWaitForTransactionReceiptError({
      cause: e as WaitForTransactionReceiptErrorType,
    }),
)
