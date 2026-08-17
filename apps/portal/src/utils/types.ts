import type { Account, Chain, Transport, WalletClient } from 'viem'

export type HttpsUrl = `https://${string}`

export type WalletClientWithAccount = WalletClient<Transport, Chain, Account>

export type ProtocolVersion = 'ENSv1' | 'ENSv2'
