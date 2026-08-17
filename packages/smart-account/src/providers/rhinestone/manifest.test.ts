import { getAddress } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import {
  DESTINATION_CONTRACTS,
  getDestinationContracts,
  SHARED_CONTRACTS,
  SOURCE_CONTRACTS,
} from './manifest'

/**
 * Guards against a mis-checksummed contract address reaching viem, which
 * rejects a mixed-case address whose EIP-55 checksum does not match with
 * `Address "0x…" is invalid` — at transaction-submission time, in the user's
 * wallet.
 *
 * Nothing else catches it: a wrong-case character type-checks, lints, and even
 * works under `cast`, which does not verify checksums. Addresses sourced from
 * ensjs are already canonical; the risk is entirely in the literals typed here
 * by hand from a deployment doc.
 */
const expectChecksummed = (label: string, address: string) => {
  expect(
    () => getAddress(address),
    `${label} is not a valid address`,
  ).not.toThrow()
  expect(getAddress(address), `${label} is not EIP-55 checksummed`).toBe(
    address,
  )
}

// Generic over the per-chain table type: the contract tables are interfaces,
// which have no index signature and so do not satisfy `Record<string, unknown>`.
const addressEntriesOf = <T extends object>(table: Record<number, T>) =>
  Object.entries(table).flatMap(([chainId, contracts]) =>
    Object.entries(contracts as Record<string, unknown>).flatMap(
      ([name, value]) =>
        typeof value === 'string'
          ? [[`${chainId}.${name}`, value] as const]
          : [],
    ),
  )

describe('remediated Sepolia destination manifest', () => {
  it('pins the complete migration namespace and current HCA deployment', () => {
    const contracts = getDestinationContracts(sepolia.id)

    expect(contracts).toEqual({
      standaloneHcaFactory: '0x900FF7cF617Ef9D802178B4ef480491e3A782672',
      standaloneHcaImplementation: '0xAA761541620fC1a42bb701a26a9f107A9DF1E904',
      hcaOwnerAndSessionValidator: '0x5f249FCa8bB4949105651146858c347E8BFb0F7E',
      verifiableFactory: '0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef',
      verifiableFactoryProxyLogic: '0xA136BeE4E37B44586242e516a39893EfD54315e9',
      verifiableFactoryDeployBlock: 11_383_823n,
      permissionedResolverImpl: '0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e',
      ethRegistrar: '0xa88553F454b77203B0D036A05c894d555EAAa2Cc',
      ethRegistry: '0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2',
      rootRegistry: '0x8115186E8f2E0B0281e86ab91f0f48Ba90364354',
      migrationHelper: '0xddC597d937618849348E18Db5D631Ce747bCDeEF',
      unlockedMigrationController: '0x2FCf83232b93bD29C59dB18AaA1D4b62e9f9FC73',
      lockedMigrationController: '0x5c39E36a69A9897F08954c71aCB1F36E0Bd4f409',
      publicResolverSet: '0xf2794eBD70C1fa74094A9eC653DA1c2dF9f5a5A9',
      wrapperRegistryImpl: '0x433F81a3E8921Fc868ae1A04576f135d9A75B0f2',
      publicResolverV2: '0xe7B9A25607E02da8145E4eB1836CA539e53F11f7',
      defaultReverseRegistrarHcaAdapter:
        '0x7a84e241f862D73960D73c26d68c3C8F89F0B18F',
      usdc: '0x768F42455A2D082E23ceeF7d51e5787C82d67a39',
    })
  })

  it('contains only checksummed addresses alongside the bigint deploy block', () => {
    const contracts = getDestinationContracts(sepolia.id)
    expect(contracts.verifiableFactoryDeployBlock).toBe(11_383_823n)

    for (const [label, address] of addressEntriesOf(DESTINATION_CONTRACTS)) {
      expectChecksummed(label, address)
    }
  })
})

describe('contract manifest addresses', () => {
  it.each(
    addressEntriesOf(SOURCE_CONTRACTS),
  )('SOURCE_CONTRACTS.%s is checksummed', (label, address) => {
    expectChecksummed(label, address)
  })

  it.each(
    Object.entries(SHARED_CONTRACTS),
  )('SHARED_CONTRACTS.%s is checksummed', (label, address) => {
    expectChecksummed(label, address)
  })
})
