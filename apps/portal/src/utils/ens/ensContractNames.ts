import {
  ensL1Contracts,
  type SupportedL1Contract,
  supportedL1Chains,
  supportedL1Contracts,
} from '@ensdomains/ensjs/chain'
import { type Address, zeroAddress } from 'viem'

/** Human-readable display names for known ENS L1 contracts */
const contractDisplayNames: Record<SupportedL1Contract, string> = {
  ensBaseRegistrarImplementation: 'BaseRegistrar',
  ensBulkRenewal: 'BulkRenewal',
  ensLegacyDnsRegistrar: 'DNSRegistrar',
  ensLegacyDnssecImpl: 'DNSSECImpl',
  ensEthRegistrarController: 'ETHRegistrarController',
  ensNameWrapper: 'NameWrapper',
  ensPublicResolver: 'PublicResolver',
  ensRegistry: 'ENSRegistry',
  ensLegacyRegistry: 'LegacyENSRegistry',
  ensReverseRegistrar: 'ReverseRegistrar',
  ensUniversalResolver: 'UniversalResolver',
  ensDefaultReverseResolver: 'DefaultReverseResolver',
  ensPermissionedResolverImpl: 'PermissionedResolver',
  ensVerifiableFactory: 'VerifiableFactory',
  ensEthRegistrar: 'ETHRegistrar',
  ensEthRenewerV1: 'ETHRenewerV1',
  ensUserRegistryImpl: 'UserRegistry',
  ensStandardRentPriceOracle: 'StandardRentPriceOracle',
  ensHcaFactory: 'HCAFactory',
  ensLockedMigrationController: 'LockedMigrationController',
  ensMigrationHelper: 'MigrationHelper',
  ensUnlockedMigrationController: 'UnlockedMigrationController',
  usdc: 'USDC',
  dai: 'DAI',
}

const contractPillLabels: Partial<Record<SupportedL1Contract, string>> = {
  ensRegistry: 'root registry',
  ensLegacyRegistry: 'legacy registry',
  ensUserRegistryImpl: 'permissioned registry',
  ensPublicResolver: 'public resolver',
  ensUniversalResolver: 'universal resolver',
  ensDefaultReverseResolver: 'reverse resolver',
  ensPermissionedResolverImpl: 'permissioned resolver',
}

// TODO(multichain): these lookups are keyed by address alone, so every
// supported chain's contracts are merged into one table — an address that's an
// ENS contract on one chain would also be labeled on another. Safe today: the
// app is sepolia-scoped, and ENS deploys many core contracts (Registry,
// BaseRegistrar, …) at the same address on both chains anyway. Once the UI
// renders data from >1 L1 chain at once, key these maps by (chainId, address)
// and thread chainId through getEnsContractName / getContractLabel and their
// EntityBadge / ContractBadge callers.
const contractNames = new Map<string, string>()
const contractPills = new Map<string, string>()

for (const chainId of Object.values(supportedL1Chains)) {
  const contracts = ensL1Contracts[chainId]
  for (const key of supportedL1Contracts) {
    const { address } = contracts[key]
    if (address === zeroAddress) continue
    const normalized = address.toLowerCase()
    contractNames.set(normalized, contractDisplayNames[key])
    const pill = contractPillLabels[key]
    if (pill) contractPills.set(normalized, pill)
  }
}

/** Human-readable ENS contract name, or undefined if not a known ENS contract. */
export const getEnsContractName = (address: Address): string | undefined =>
  contractNames.get(address.toLowerCase())

/** EntityBadge label: short pill when known, otherwise the contract display name. */
export const getContractLabel = (address: Address): string | undefined =>
  contractPills.get(address.toLowerCase()) ?? getEnsContractName(address)
