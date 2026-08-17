import { ensL1Contracts } from '@ensdomains/ensjs/chain'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { getContractLabel, getEnsContractName } from './ensContractNames'

const SEPOLIA = 11155111
const sepoliaContracts = ensL1Contracts[SEPOLIA]

describe('getEnsContractName', () => {
  it('returns undefined for an unrecognised address', () => {
    expect(
      getEnsContractName(
        '0x0000000000000000000000000000000000001234' as Address,
      ),
    ).toBeUndefined()
  })

  it('returns the display name for a known contract (exact case)', () => {
    expect(
      getEnsContractName(
        '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85' as Address,
      ),
    ).toBe('BaseRegistrar')
  })

  it('is case-insensitive for the address', () => {
    expect(
      getEnsContractName(
        '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85' as Address,
      ),
    ).toBe('BaseRegistrar')
    expect(
      getEnsContractName(
        '0x57F1887A8BF19B14FC0DF6FD9B2ACC9AF147EA85' as Address,
      ),
    ).toBe('BaseRegistrar')
  })

  it('returns correct labels for several mainnet contracts', () => {
    const cases: [Address, string][] = [
      ['0xa12159e5131b1eEf6B4857EEE3e1954744b5033A', 'BulkRenewal'],
      ['0xB32cB5677a7C971689228EC835800432B339bA2B', 'DNSRegistrar'],
      ['0x0fc3152971714E5ed7723FAFa650F86A4BaF30C5', 'DNSSECImpl'],
      ['0x253553366Da8546fC250F225fe3d25d0C782303b', 'ETHRegistrarController'],
      ['0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401', 'NameWrapper'],
      ['0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63', 'PublicResolver'],
    ]
    for (const [address, expected] of cases) {
      expect(getEnsContractName(address)).toBe(expected)
    }
  })

  it('returns correct labels for sepolia contracts', () => {
    const cases: [Address, string][] = [
      [
        sepoliaContracts.ensBaseRegistrarImplementation.address,
        'BaseRegistrar',
      ],
      [sepoliaContracts.ensBulkRenewal.address, 'BulkRenewal'],
      [
        sepoliaContracts.ensEthRegistrarController.address,
        'ETHRegistrarController',
      ],
      [sepoliaContracts.ensNameWrapper.address, 'NameWrapper'],
      [sepoliaContracts.ensRegistry.address, 'ENSRegistry'],
      [sepoliaContracts.ensUniversalResolver.address, 'UniversalResolver'],
    ]
    for (const [address, expected] of cases) {
      expect(getEnsContractName(address)).toBe(expected)
    }
  })

  it('does not return names for zeroAddress entries', () => {
    expect(
      getEnsContractName(
        '0x0000000000000000000000000000000000000000' as Address,
      ),
    ).toBeUndefined()
  })
})

describe('getContractLabel', () => {
  it('prefers the short pill label over the display name', () => {
    expect(getContractLabel(sepoliaContracts.ensRegistry.address)).toBe(
      'root registry',
    )
    expect(getContractLabel(sepoliaContracts.ensLegacyRegistry.address)).toBe(
      'legacy registry',
    )
    expect(getContractLabel(sepoliaContracts.ensUserRegistryImpl.address)).toBe(
      'permissioned registry',
    )
    expect(getContractLabel(sepoliaContracts.ensPublicResolver.address)).toBe(
      'public resolver',
    )
    expect(
      getContractLabel(sepoliaContracts.ensUniversalResolver.address),
    ).toBe('universal resolver')
    expect(
      getContractLabel(sepoliaContracts.ensDefaultReverseResolver.address),
    ).toBe('reverse resolver')
    expect(
      getContractLabel(sepoliaContracts.ensPermissionedResolverImpl.address),
    ).toBe('permissioned resolver')
  })

  it('falls back to the display name for other known contracts', () => {
    expect(getContractLabel(sepoliaContracts.ensEthRegistrar.address)).toBe(
      'ETHRegistrar',
    )
    expect(getContractLabel(sepoliaContracts.ensNameWrapper.address)).toBe(
      'NameWrapper',
    )
  })

  it('returns undefined for unrecognised addresses', () => {
    expect(
      getContractLabel('0x0000000000000000000000000000000000001234' as Address),
    ).toBeUndefined()
  })
})
