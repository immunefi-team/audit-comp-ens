import { describe, expect, it } from 'vitest'

import { transformAgentRegistrationRecord } from './transformAgentRegistrationRecord'

// ERC-7930 encoded address for mainnet (chain ID 1) with the known 8004.eth
// registry address 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432.
const KNOWN_REGISTRY_HEX =
  '0x00010000010114' + '8004a169fb4a3325136eb29fa0ceb6d2e539a432'

describe('transformAgentRegistrationRecord', () => {
  it('transforms a valid agent-registration record', () => {
    const key = `agent-registration[${KNOWN_REGISTRY_HEX}][19151]`
    const result = transformAgentRegistrationRecord({ key, value: '1' })

    expect(result).toMatchObject({
      key,
      value: '1',
      agentId: '19151',
      chainId: 1,
      registryAddress: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    })
  })

  it('resolves the known registry address to its primary name', () => {
    const key = `agent-registration[${KNOWN_REGISTRY_HEX}][167]`
    const result = transformAgentRegistrationRecord({ key, value: '1' })

    expect(result?.registryDisplayName).toBe('8004.eth')
  })

  it('falls back to a shortened raw address for unknown registries', () => {
    // Same encoding but a non-known registry address.
    const unknownRegistryHex =
      '0x00010000010114' + '1234567890abcdef1234567890abcdef12345678'
    const key = `agent-registration[${unknownRegistryHex}][42]`
    const result = transformAgentRegistrationRecord({ key, value: '1' })

    expect(result?.registryDisplayName).toBe('0x1234...5678')
    expect(result?.registryAddress).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    )
  })

  it('returns null for a non-agent-registration key', () => {
    expect(
      transformAgentRegistrationRecord({ key: 'com.twitter', value: 'name' }),
    ).toBeNull()
  })

  it('returns null when the registry hex is not a valid ERC-7930 address', () => {
    expect(
      transformAgentRegistrationRecord({
        key: 'agent-registration[0xdeadbeef][123]',
        value: '1',
      }),
    ).toBeNull()
  })
})
