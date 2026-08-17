import { getDestinationContracts } from '@ens-apps/smart-account'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { sepoliaWithEns } from '@/lib/wagmi'

const destination = getDestinationContracts(sepoliaWithEns.id)

export const V2_DEPLOY_BLOCK = destination.verifiableFactoryDeployBlock

// V1 contracts remain the canonical Sepolia ENS deployment. The PR #388
// namespace rotation only applies to the V2/HCA contracts below.
export const V1_CONTRACTS = {
  BaseRegistrar: getChainContractAddress({
    chain: sepoliaWithEns,
    contract: 'ensBaseRegistrarImplementation',
  }),
  NameWrapper: getChainContractAddress({
    chain: sepoliaWithEns,
    contract: 'ensNameWrapper',
  }),
} as const

// V2/HCA contracts are the pinned contracts-v2 PR #388 namespace. Do not source
// these from ensjs until it publishes this exact coordinated deployment.
//
// `DefaultResolver` is the V2 PublicResolver (`ensPublicResolver`), written into
// each migrated name's registry slot as a fallback (used by the migration plan
// when a name's existing v1 resolver is unknown, or when the owner doesn't yet
// have a dedicated PermissionedResolver instance).
export const V2_CONTRACTS = {
  ETHRegistry: destination.ethRegistry,
  RootRegistry: destination.rootRegistry,
  VerifiableFactory: destination.verifiableFactory,
  VerifiableFactoryProxyLogic: destination.verifiableFactoryProxyLogic,
  PermissionedResolverImpl: destination.permissionedResolverImpl,
  UnlockedMigrationController: destination.unlockedMigrationController,
  LockedMigrationController: destination.lockedMigrationController,
  MigrationHelper: destination.migrationHelper,
  PublicResolverSet: destination.publicResolverSet,
  WrapperRegistryImpl: destination.wrapperRegistryImpl,
  DefaultResolver: destination.publicResolverV2,
  StandaloneHCAFactory: destination.standaloneHcaFactory,
  StandaloneHCAImplementation: destination.standaloneHcaImplementation,
  HCAOwnerAndSessionValidator: destination.hcaOwnerAndSessionValidator,
} as const
