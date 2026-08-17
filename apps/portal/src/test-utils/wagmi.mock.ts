import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { mock } from '@wagmi/connectors'
import { http } from 'viem'
import { sepolia } from 'viem/chains'
import { createConfig } from 'wagmi'

export const sepoliaWithEns = extendChainWithEns(sepolia)

/**
 * Mock wagmi config for testing
 * Uses the mock connector with predefined test accounts
 */
export const mockWagmiConfig = createConfig({
  chains: [sepoliaWithEns],
  connectors: [
    mock({
      accounts: [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      ],
    }),
  ],
  transports: {
    [sepoliaWithEns.id]: http(),
  },
})

/**
 * Test account addresses for use in tests
 */
export const TEST_ACCOUNTS = {
  alice: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
  bob: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as const,
  charlie: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const,
} as const
