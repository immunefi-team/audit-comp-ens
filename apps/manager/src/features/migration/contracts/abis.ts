import {
  publicResolverAbiSnippet,
  publicResolverContenthashSnippet,
  publicResolverMultiAddrSnippet,
  publicResolverMulticallSnippet,
  publicResolverSetAbiSnippet,
  publicResolverSetAddrSnippet,
  publicResolverSetContenthashSnippet,
  publicResolverSetTextSnippet,
  publicResolverTextSnippet,
} from '@ensdomains/ensjs-abi/v1/publicResolver'
import { eacGrantRolesSnippet } from '@ensdomains/ensjs-abi/v2/enhancedAccessControl'
import { migrationHelperMigrateSnippet } from '@ensdomains/ensjs-abi/v2/migrationHelper'
import {
  permissionedRegistryGetResolverSnippet,
  permissionedRegistryGetSubregistrySnippet,
} from '@ensdomains/ensjs-abi/v2/permissionedRegistry'
import { verifiableFactoryDeployProxySnippet } from '@ensdomains/ensjs-abi/v2/verifiableFactory'
import { parseAbi } from 'viem'

export { BASE_REGISTRAR_ABI, NAME_WRAPPER_ABI } from '@ens-apps/migration'

// TODO(ensjs): upstream `getStatus(uint256) view returns (uint8)` on ETHRegistry
// to @ensdomains/ensjs-abi/v2/permissionedRegistry and drop this local snippet.
const ethRegistryGetStatusSnippet = parseAbi([
  'function getStatus(uint256 anyId) view returns (uint8)',
])

// Shared by the V1 NFT contracts and the V2 registry. Migration grants the
// wallet-owned HCA operator access that can be reused for later operations.
export const OPERATOR_APPROVAL_ABI = parseAbi([
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
])

// TODO(ensjs): `subregistryInitializeSnippet` in
// @ensdomains/ensjs-abi/v2/verifiableFactory still declares the 2-arg
// `initialize(address, uint256)`. The deployed PermissionedResolver takes a
// third `setters` argument (a multicall batch run at init time), so encoding
// the old form yields selector 0xcd6dc687 — which the implementation no longer
// exposes, making the initializer delegatecall revert with empty data.
// Drop this once ensjs-abi carries the 3-arg form.
// See contracts-v2 `src/resolver/PermissionedResolver.sol`.
const subregistryInitializeSnippet = parseAbi([
  'function initialize(address admin, uint256 roleBitmap, bytes[] setters)',
])

export const ETH_REGISTRY_V2_ABI = [
  ...permissionedRegistryGetSubregistrySnippet,
  ...permissionedRegistryGetResolverSnippet,
  ...ethRegistryGetStatusSnippet,
  ...OPERATOR_APPROVAL_ABI,
  ...eacGrantRolesSnippet,
] as const

export const VERIFIABLE_FACTORY_ABI = verifiableFactoryDeployProxySnippet

export const PERMISSIONED_RESOLVER_ABI = [
  ...subregistryInitializeSnippet,
  ...publicResolverMulticallSnippet,
  ...publicResolverSetTextSnippet,
  ...publicResolverSetAddrSnippet,
  ...publicResolverSetContenthashSnippet,
  ...publicResolverSetAbiSnippet,
  ...publicResolverTextSnippet,
  ...publicResolverMultiAddrSnippet,
  ...publicResolverContenthashSnippet,
  ...publicResolverAbiSnippet,
] as const

export const MIGRATION_HELPER_ABI = migrationHelperMigrateSnippet

// LibMigration errors — these come back wrapped inside Error(string) due to
// NameWrapper's transfer-error squelching. decodeMigrationError unwraps and
// matches against this ABI.
export const LIB_MIGRATION_ERRORS_ABI = parseAbi([
  'error NameRequiresMigration()',
  'error NameNotLocked(uint256 tokenId)',
  'error NameIsLocked(uint256 tokenId)',
  'error NameDataMismatch(uint256 tokenId)',
  'error FrozenTokenApproval(uint256 tokenId)',
  'error InvalidData()',
])
