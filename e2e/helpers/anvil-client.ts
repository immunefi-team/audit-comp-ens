/**
 * Shared viem clients for the local Anvil Sepolia fork.
 *
 * Provides publicClient (read), testClient (anvil manipulation),
 * and walletClient (write) all pointing at the same RPC endpoint.
 */
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
} from 'viem'
import { sepolia } from 'viem/chains'

const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'

const transport = http(ANVIL_RPC_URL)

/**
 * Override Sepolia to use the local Anvil RPC.
 * Chain ID stays 11155111 so contract addresses match the fork.
 */
const localSepolia = {
  ...sepolia,
  rpcUrls: {
    default: { http: [ANVIL_RPC_URL] },
  },
} as const

export const publicClient = createPublicClient({
  chain: localSepolia,
  transport,
})

export const testClient = createTestClient({
  chain: localSepolia,
  transport,
  mode: 'anvil',
})

export const walletClient = createWalletClient({
  chain: localSepolia,
  transport,
})
