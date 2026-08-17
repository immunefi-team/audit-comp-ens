/**
 * Smart Account Type Guards Tests
 */

// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks require flexible typing
import { describe, expect, it } from 'vitest'

import { isRhinestoneAccount, type RhinestoneAccountState } from './types'

const createBaseState = () => ({
  accountAddress: null,
  isLoading: false,
  error: null,
  isConnected: false,
  walletSource: null,
  ownerAddress: null,
  stablecoinBalances: [],
  isLoadingBalances: false,
  smartAccountEthBalance: null,
  isLoadingSmartAccountEth: false,
  autoFundingMutation: {} as any,
  signer: null,
})

const createRhinestoneState = (
  overrides: Partial<RhinestoneAccountState> = {},
): RhinestoneAccountState => ({
  ...createBaseState(),
  type: 'rhinestone',
  client: null,
  config: null,
  isAccountReady: false,
  ...overrides,
})

describe('isRhinestoneAccount', () => {
  it('returns true for Rhinestone account state', () => {
    const rhinestoneState = createRhinestoneState()

    expect(isRhinestoneAccount(rhinestoneState)).toBe(true)
  })

  it('correctly narrows type for Rhinestone account', () => {
    const rhinestoneState = createRhinestoneState({
      client: { getAddress: () => '0x123' } as any,
      config: {
        chain: {} as any,
        rhinestoneApiKey: 'test-key',
      },
    })

    if (isRhinestoneAccount(rhinestoneState)) {
      // TypeScript should allow access to Rhinestone-specific properties
      expect(rhinestoneState.type).toBe('rhinestone')
      expect(rhinestoneState.client).toBeDefined()
      expect(rhinestoneState.config?.rhinestoneApiKey).toBe('test-key')
    }
  })
})
