# Anvil state directory

This directory holds `state.json` — a pre-seeded Anvil state snapshot for the ENS V2 Snapshot image.

## How it works

1. `seed-state.sh` forks Sepolia at the latest block, then runs `bake-contracts.py` to write all required contracts into the local state, funds test accounts, and dumps the result to `state.json`.
2. `Dockerfile.anvil-snapshot` copies `state.json` into the image at build time.
3. CI pulls `ghcr.io/ensdomains/ens-v2-snapshot:latest` and starts Anvil with `--load-state /state.json` — no live RPC needed, ready in under 5 seconds.

## Why bake-contracts.py is needed

`anvil_dumpState` only serialises accounts that were *written* locally; contracts that were only *read* through the fork cache are excluded. `bake-contracts.py` forces each required contract's bytecode and storage into the local state via `anvil_setCode`/`anvil_setStorageAt` so they survive the dump.

Contracts baked:

| Group | What |
|---|---|
| EVM infra | Multicall3 |
| ERC-4337 | EntryPoint v0.6/v0.7/v0.8, simulators |
| ENS V2 core | ETH Registry, ETH Registrar, FastTest Registrar, Registry Datastore, Public Resolver, Reverse Registrar, ENS Registry (v1), Name Wrapper |
| ENS V2 resolution | Universal Resolver V2, BatchGatewayProvider, Root Registry (+ `"eth"` subregistry slots), UserRegistry Impl |
| ENS factories | HCA Factory, Verifiable Factory, Dedicated Resolver Impl |
| Standalone HCA | StandaloneHCAFactory + Impl, HCAOwnerAndSessionValidator (+ its INTENT_EXECUTOR / GAS_REFUND_PAYMASTER immutables), standalone ETH Registrar/Registry/PermissionedResolver impl + Verifiable Factory (+ proxy logic), DefaultReverseRegistrarHCAAdapter, Circle Sepolia USDC |
| Safe / Rhinestone | SafeProxyFactory, Safe Singleton, Safe7579 adapters/launchpads, all Rhinestone modules + impl contracts, known smart accounts |

Special cases in the bake script:
- **ETH Registry `_roles` at slot 2** — `ERC1155Singleton` occupies slots 0–1 before `EnhancedAccessControl` in the C3 MRO, so `_roles` is at slot 2, not 0. Applies to BOTH the ENS-V2 core registry and the standalone registry (same `PermissionedRegistry` layout).
- **Root Registry `"eth"` entry** — two hash-addressed storage slots hardcoded as `ROOT_REGISTRY_ETH_SLOTS` (found via `prestateTracer`).
- **Price oracle dynamic arrays** — base-rate arrays at slots 3/4 need element-level baking via `bake_dynamic_array()`. Both registrars' oracles are discovered via `rentPriceOracle()` and baked.
- **Standalone validator immutables** — `INTENT_EXECUTOR` / `GAS_REFUND_PAYMASTER` are read from `HCAOwnerAndSessionValidator` on the fork and their code baked (the intent executor is already covered by the Rhinestone module set; the gas-refund paymaster is standalone-only).
- **Circle USDC** — FiatTokenV2_2: `balances` mapping at slot 9, `allowed` at slot 10 (mockestrator `chains.json` uses these). Balances are set per-account via `anvil_setStorageAt` at fund time (no open `mint`).

## state.json is NOT committed

`state.json` is generated at build time and baked into `ghcr.io/ensdomains/ens-v2-snapshot:latest` by the `build-ens-v2-snapshot` GitHub Actions workflow. It is listed in `.gitignore` and must not be committed to the repository.

## Regenerating the image

The image is rebuilt weekly (Monday 02:00 UTC) by the `build-ens-v2-snapshot` workflow. You can also trigger a manual rebuild from the Actions tab, optionally pinning a specific Sepolia block number.

To build locally:

```bash
SEPOLIA_FORK_URL=https://... bash e2e/infra/scripts/seed-state.sh
docker build -f e2e/infra/Dockerfile.anvil-snapshot -t ghcr.io/ensdomains/ens-v2-snapshot:latest e2e/infra
```
