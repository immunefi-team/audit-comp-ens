## ENSv1 Token Types

1. **Unwrapped** — `BaseRegistrar` ERC-721 (only 2LD)
2. **Unlocked** — `NameWrapper` ERC-1155 w/o `CANNOT_UNWRAP` (only 2LD)
3. **Emancipated** — `NameWrapper` w/ `PARENT_CANNOT_CONTROL`
    1. **Locked** — w/ `CANNOT_UNWRAP` (2LD+)
    2. **Detached** — w/o `CANNOT_UNWRAP` and parent is **Locked** (3LD+)

## Definitions

- Migration only supports descendants of `"eth"`
- **Locked** status is determined by `CANNOT_UNWRAP`
    - see: `_isLocked()`
    - `CANNOT_UNWRAP` cannot be set without `PARENT_CANNOT_CONTROL`
- **Emancipated** status is determined by `PARENT_CANNOT_CONTROL`
    - Every **Locked** token is **Emancipated**
    - Technically, every 2LD is **Emancipated** but not via `NameWrapper`
- **Detached** status is **Emancipated** and parent is **Locked** (therefore not `IS_DOT_ETH`)
    - see: `_isEmancipatedChild()`
- A child of a **Locked** token can only be migrated if the parent has migrated and the child is **Emancipated** (**Locked** or **Detached**)
    - see: `_isMigratableChild()`
- `ETHRegistry` is the registry for `"eth"` in ENSv2
- `ETHRegistrar` is the registrar for `ETHRegistry`
- `Graveyard` is the burn address for migrated tokens

## Migration Receivers

1. `UnlockedMigrationController` 
    1. `IERC721Receiver`→ **Unwrapped** 2LD
    2. `AbstractWrapperReceiver` → **Unlocked** 2LD
2. `LockedMigrationController` 
    1. `LockedWrapperReceiver` → **Locked** 2LD
3. `WrapperRegistry`
    1. `LockedWrapperReceiver` → **Locked** or **Detached** 3LD+

---

- `AbstractWrapperReceiver` is `IERC1155Receiver` and only accepts `NameWrapper` tokens

- `LockedWrapperReceiver` is `AbstractWrapperReceiver` and only accepts **Emancipated** tokens

## Migration Assumptions

- Premigration has occurred
    - Expiries “too close” (TBD: 7 days?) to ENSv2 launch will be extended in ENSv1
    - Every ENSv1 name is `RESERVED` on `ETHRegistry` with synced ENSv1 expiry and resolver set to `ENSV1Resolver` which performs wildcard fallback to ENSv1
    - ENSv1 .eth registration is disabled
        - Therefore, there is only one token per 2LD, and after migration, the controller owns it until expiry
- Migration controllers are granted `ROLE_REGISTER_RESERVED` on `ETHRegistry`
- `ETHRegistrar` lacks `ROLE_REGISTER_RESERVED` therefore `RESERVED` names (unmigrated) cannot be registered until they expire
- After migration, the migration controllers hold transferable tokens but have no upgrade or transfer mechanism
    - ENSv1 registry namespace beneath the 2LD is unchanged

## General Restrictions

- Migration is impossible if a token cannot be transferred
- `BaseRegistrar` tokens can only be transferred by owner or approved operators
    - underlying `ERC721` implementation allows typed error propagation from `onERC721Received()`
- `NameWrapper` tokens can only be transferred by owner or approved operators
    - `approve()` does not authorize transfer
    - underlying `ERC1155Fuse` implementation allows `Error(string)` reverts during `onERC1155Received()` but converts typed errors to `Error("ERC1155: transfer to non ERC1155Receiver implementer")`
    - `AbstractWrapperReceiver` and `WrappedErrorLib` implement logic to catch, wrap, and unwrap typed errors
    - `safeBatchTransferFrom()` reverts on the first error encountered
- Migration fails if the ENSv2 token receiver is null or not an accepting receiver

# Migration Cases

## Unwrapped

1. Token is transferred to `UnlockedMigrationController`, the only valid receiver:
    - Every other receiver lacks`IERC721Receiver`
2. `safeTransferFrom()`payload `data` must be `abi.encode(LibMigration.Data)` or reverts `InvalidData`
3. `tokenId` must match `keccak256(bytes(Data.label))` or reverts `NameDataMismatch`
4. Token is reclaimed on the `BaseRegistrar` 
5. Resolver is cleared
6. Token is transferred to `Graveyard`
7. `Data.label` is registered in `ETHRegistry` 
    1. Since premigration has occurred and  `UnlockedMigrationController` only has `ROLE_RESERVE_REGISTER`, `Data.label` is `RESERVED` and has the correct `expiry`
    2. `Data.owner`, `Data.resolver` and `Data.subregistry` are used accordingly
    3. The token roles are the same as `ETHRegistrar.register()`

## Unlocked

- 
1. Token is transferred to `UnlockedMigrationController`, the only valid receiver:
    1. `LockedMigrationController` reverts `NameNotLocked` 
    2. Every `WrapperRegistry` reverts `NameDataMismatch` (wrong parent)
2. `safeTransferFrom()`payload `data` must be `abi.encode(LibMigration.Data)` or `safeBatchTransferFrom()` payload `data` must be `abi.encode(LibMigration.Data[])` or reverts `InvalidData` 
3. Token must be **Unlocked** or reverts `NameIsLocked`
4. `tokenId` must match `namehash("{Data.label}.eth")` or reverts `NameDataMismatch`
    - **Unlocked 3LD+** cannot be migrated and must be registered directly
5. Token is unwrapped to `Graveyard`
    - `Graveyard` is the token owner until expiry
    - `NameWrapper` is the `ENSRegistry` owner
6. Resolver is cleared
    - Note: `CANNOT_SET_RESOLVER` cannot be burned while **Unlocked**
7. `Data.label` is registered in `ETHRegistry` 
    1. Since premigration has occurred and  `UnlockedMigrationController` only has `ROLE_RESERVE_REGISTER`, `Data.label` is `RESERVED` and has the correct `expiry`
    2. `Data.owner`, `Data.resolver` and `Data.subregistry` are used accordingly
    3. The token roles are the same as `ETHRegistrar.register()`

## Emancipated

1. Token is transferred to the unique receiver dependent on its name:
    - For 2LD,`LockedMigrationController` is the only valid receiver:
        - `UnlockedMigrationController` reverts `NameIsLocked`
        - Every `WrapperRegistry` reverts `NameDataMismatch` (wrong parent)
    - For 3LD+, the `WrapperRegistry` where `getWrappedName()`  corresponds to the parent is the only valid receiver:
        - `UnlockedMigrationController` reverts `NameIsLocked`
        - `LockedMigrationController` reverts `NameDataMismatch` (wrong parent)
        - Every other `WrapperRegistry` reverts `NameDataMismatch` (wrong parent)
    - If there is no `WrapperRegistry`, the parent hasn’t migrated yet
        - Token must be extended in ENSv1 to stay active
        - The name cannot be registered in ENSV2 until it migrates or expires
        - The ENSv2 resolver returns `ENSV1Resolver` during this period
2. `safeTransferFrom()`payload `data` must be `abi.encode(LibMigration.Data)` or `safeBatchTransferFrom()` payload `data` must be `abi.encode(LibMigration.Data[])` or reverts `InvalidData` 
3. `tokenId` must match `namehash("{Data.label}.{getWrappedName()}"` or reverts `NameDataMismatch` 
    - Note: `LockedMigrationController.getWrappedName() = "eth"`
4. The token must be: **Locked** or **Detached** or reverts `NameNotLocked`

## Emancipated → Locked

1. `getApproved()` must be null or reverts `FrozenTokenApproval`
    - If `CANNOT_APPROVE = false`, approval is automatically cleared during transfer
2. Token is not unwrapped
    - `LockedMigrationController` is the token owner until expiry
    - `NameWrapper` is the `ENSRegistry` owner
3. Resolver is cleared unless `CANNOT_SET_RESOLVER` is burned and `Data.resolver` is replaced with the current ENSv1 resolver
4. `Data.label` is registered in the parent registry: 
    1. The parent registry is derived from the receiver:
        1. For 2LD, `LockedMigrationController._getRegistry() = ETHRegistry` 
            - Since premigration has occurred and  `LockedMigrationController` only has `ROLE_RESERVE_REGISTER`, `Data.label` is `RESERVED` and has the correct `expiry`
        2. For 3LD+, every `WrapperRegistry._getRegistry()` is itself
            - The `expiry` is copied from the **Locked** token
            - `WrapperRegistry._inject()` registers the name without needing `ROLE_REGISTER`
    2. `Data.owner` and `Data.resolver` are used accordingly
    3. The `subregistry` is set to a newly deployed `WrapperRegistry` 
        - `Data.owner` is granted the following `ROOT_RESOURCE` roles:
            1. `CANNOT_CREATE_SUBDOMAIN = false`→ `ROLE_REGISTRAR`
            2. `CANNOT_BURN_FUSES = false` → admin roles for any granted roles so far
            3. `ROLE_RENEW` and `ROLE_RENEW_ADMIN` 
        - `WrapperRegistry` is canonical and cannot be changed
    4. The token is granted the following roles:
        1. `CAN_EXTEND_EXPIRY = true` → `ROLE_RENEW`
        2. `CANNOT_SET_RESOLVER = false`→ `ROLE_SET_RESOLVER`
        3. `CANNOT_BURN_FUSES = false`→ admin roles for any granted roles so far
        4. `CANNOT_TRANSFER = false`→ `ROLE_CAN_TRANSFER_ADMIN` 

## Emancipated → Detached

1. Token is unwrapped to `Graveyard`
2. Resolver is cleared 
3. `Data.label` is registered in the parent registry: 
    1. `Data.owner`, `Data.resolver` and `Data.subregistry` are used accordingly
    2. The token roles are the same as `ETHRegistrar.register()`

## Unmigratable

1. **Unwrapped** or **Unlocked** and not transferable due to owner
2. **Locked** and not transferable due to owner or `CANNOT_TRANSFER = true` 
3. **Locked** with `CANNOT_APPROVE = true` and non-null `getApproved()`
4. **Emancipated 3LD+** with parent that has not migrated yet

## Unmigrated

- ENSv1 tokens eventually expire leaving registry state frozen
    - `resolver` and `owner` are frozen
    - If wrapped, `NameWrapper`-aware resolvers (eg.`PublicResolver`) are frozen
- `ETHRegistrar` can renew unmigrated names at cost
- `ENSV1Resolver` will resolve until expired in ENSv2
- `Graveyard` can clear owned and expired namespaces

## NameWrapper Fuse Implications

Reference: [INameWrapper.sol](https://github.com/ensdomains/ens-contracts/blob/staging/contracts/wrapper/INameWrapper.sol#L10-L21)

- `CANNOT_UNWRAP` → **Locked**
- `CANNOT_BURN_FUSES` → not granted admin-equivalent roles
- `CANNOT_TRANSFER` →  `ROLE_CAN_TRANSFER_ADMIN` on token
- `CANNOT_SET_RESOLVER` → `ROLE_SET_RESOLVER`  on token
- `CANNOT_SET_TTL` → ignored
- `CANNOT_CREATE_SUBDOMAIN` → `ROLE_REGISTRAR` on subregistry
- `CANNOT_APPROVE` → reverts if `getApproved()` is not null
- `PARENT_CANNOT_CONTROL` → see [definitions](https://www.notion.so/ENSv2-Migration-Case-Study-31f7a8b1f0ed802db30bea0050ec3b89?pvs=21)
- `IS_DOT_ETH` →  see [definitions](https://www.notion.so/ENSv2-Migration-Case-Study-31f7a8b1f0ed802db30bea0050ec3b89?pvs=21)
- `CAN_EXTEND_EXPIRY` → `ROLE_RENEW` on token
- `CAN_DO_EVERYTHING` → **Unlocked**