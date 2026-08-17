import { TaggedError } from '@ens-apps/utils/neverthrow'
import {
  type GetConnectorClientErrorType,
  getConnectorClient,
} from '@wagmi/core'
import { fromAsyncThrowable, fromThrowable } from 'neverthrow'
import type { Client, CreateClientErrorType, Transport } from 'viem'
import { type sepoliaWithEns, wagmiConfig } from '../wagmi'

class WagmiClientError extends TaggedError('Wagmi/ClientError')<{
  cause: CreateClientErrorType
}> {}

export const safeGetClient = fromThrowable(
  () => wagmiConfig.getClient() as Client<Transport, typeof sepoliaWithEns>,
  (e) => new WagmiClientError({ cause: e as CreateClientErrorType }),
)

class WagmiConnectorClientError extends TaggedError(
  'Wagmi/ConnectorClientError',
)<{
  cause: GetConnectorClientErrorType
}> {}

export const safeGetConnectorClient = fromAsyncThrowable(
  getConnectorClient,
  (e) =>
    new WagmiConnectorClientError({ cause: e as GetConnectorClientErrorType }),
)
