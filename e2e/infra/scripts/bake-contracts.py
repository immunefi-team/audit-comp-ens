#!/usr/bin/env python3
"""
Bake required contracts into the local Anvil fork state so they survive
anvil_dumpState. anvil_dumpState only serialises accounts that were written
locally; accounts only read via the fork cache are excluded.

For each contract we:
  1. anvil_setCode  — write bytecode into the modified-accounts set
  2. Scan storage slots 0-127 — picks up all sequentially-laid-out variables
  3. Compute and copy critical hash-addressed mapping slots (payment ratios,
     role bitmaps) so the contracts are fully functional without a fork URL.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from typing import Optional

RPC_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8545"

# ── General EVM infrastructure ─────────────────────────────────────────────
# Multicall3: used by viem's batch.multicall — every readContract call goes
# through this. Without it all publicClient.readContract calls fail silently.
INFRA_CONTRACTS = [
    ("0xcA11bde05977b3631167028862bE2a173976CA11", "Multicall3"),
]

# ── ERC-4337 contracts (code only — no meaningful storage needed) ──────────
ERC4337_CONTRACTS = [
    ("0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789", "EntryPoint v0.6"),
    ("0x0000000071727De22E5E9d8BAf0edAc6f37da032", "EntryPoint v0.7"),
    ("0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", "EntryPoint v0.8"),
    ("0x8e1128803171F1F04b00C783fd19DC0d7711001F", "EntryPoint sim v7"),
    ("0x469a6Cc4206B7d49a7a3b7CC917aFefA514A752e", "EntryPoint sim v8"),
    ("0x71b5A95992B3B1C1e9D2160eAfaA0f1C0ad5A310", "EntryPoint sim v9"),
    ("0x9Bd3B766d8F8cFf18520c4D05EddDf0F0EA078Ae", "Pimlico sim"),
]

# ── ENS contracts (code + storage) ────────────────────────────────────────
# Addresses from contracts.snapshot.json / contracts.json
ETH_REGISTRY    = "0x796fff2e907449be8d5921bcc215b1b76d89d080"
ETH_REGISTRAR   = "0x68586418353b771cf2425ed14a07512aa880c532"
FAST_TEST_REGISTRAR = "0xbbf892aea9bb883b36bab2adc7831a6c63ef1e39"
REG_DATASTORE   = "0x5a9236e72a66d3e08b83dcf489b4d850792b6009"
PUBLIC_RESOLVER = "0x640294a2b2d87e7f522db3e3e3e876764bce170d"
REV_REGISTRAR   = "0xa35e6c5dc06e820cc6716ca33dfcd203503fb1d3"
ENS_REGISTRY    = "0x7e89b563f936c68c31a360840eb7f9a4aacaf014"
NAME_WRAPPER    = "0xc7e033b8836e4bd55d069d113f018b98478cb091"
HCA_FACTORY              = "0x12919bd18e9eb9f004e2faf78709d0319747d761"
VERIFIABLE_FACTORY       = "0x9240c5f31d747d60b3d9aed2f57995094342b1ed"
DEDICATED_RESOLVER_IMPL  = "0xe566a1fbaf30ff7c39828fe99f955fc55544cb9c"
UNIVERSAL_RESOLVER       = "0x4dc74fef4fc6b5a810a1554d431f06c8d8b7451c"
BATCH_GATEWAY_PROVIDER   = "0xdd618e84bfdbe3f8c4bf70ad000493977d824ab9"
ROOT_REGISTRY            = "0x3a3e15a5d27ff6f05c844313312f2e72096d3ed3"
USER_REGISTRY_IMPL       = "0xea93aff7375e8176053ab6ab36b57cab53cbf702"

# Storage slots for Root Registry's "eth" subregistry entry.
# These hash-addressed slots hold the (ETH Registry address, flags) struct for
# the "eth" label. Found via debug_traceCall with prestateTracer on getSubregistry("eth").
ROOT_REGISTRY_ETH_SLOTS = [
    "0x400313669055dc4990165771718a1ce8d73da104df8da41a522793dae4bac649",
    "0x400313669055dc4990165771718a1ce8d73da104df8da41a522793dae4bac64a",
]

# ── Safe / Rhinestone infrastructure ──────────────────────────────────────
# Required for Rhinestone smart account deployment and execution in snapshot mode.
# These are deterministic CREATE2 deployments present on Sepolia.
SAFE_PROXY_FACTORY    = "0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67"
SAFE_SINGLETON        = "0x29fcb43b46531bca003ddc8fcb67ffe91900c762"
SAFE_7579_LAUNCHPAD_V1 = "0x7579011ab74c46090561ea277ba79d510c6c00ff"
SAFE_7579_ADAPTER_V1   = "0x7579ee8307284f293b1927136486880611f20002"
SAFE_7579_LAUNCHPAD_V2 = "0x75798463024bda64d83c94a64bc7d7eab41300ef"
SAFE_7579_ADAPTER_V2   = "0x7579f2ad53b01c3d8779fe17928e0d48885b0003"

# ── Rhinestone module contracts ────────────────────────────────────────────
# All module/validator/policy contracts referenced by @rhinestone/sdk v1.5.1.
# Addresses sourced from node_modules/@rhinestone/sdk/dist/src/.
RHINESTONE_MODULES = [
    ("0x000000000032ddc454c3bdcba80484ad5a798705", "Nexus Implementation"),
    ("0xad568b3f825a8d5ffc06dd3253526b64d810ae89", "SmartSession Emissary"),
    ("0x000000000052e9685932845660777DF43C2dC496", "SmartSession Compat Fallback"),
    ("0x000000000013fdb5234e4e3162a810f54d9f7e98", "OwnableValidator"),
    ("0xdc38f07b060374b6480c4bf06231e7d10955bca4", "ENS Validator"),
    ("0x0000000000578c4cb0e472a5462da43c495c3f33", "WebAuthn Validator"),
    ("0x0000000000e9e6e96bcaa3c113187cdb7e38aed9", "OwnableBeta Validator"),
    ("0x000000333034E9f539ce08819E12c1b8Cb29084d", "Rhinestone Attester"),
    ("0x0000000000f6Ed8Be424d673c63eeFF8b9267420", "Hook"),
    ("0x000000000043ff16d5776c7F0f65Ec485C17Ca04", "SameChain Module"),
    ("0x00000000005aD9ce1f5035FD62CA96CEf16AdAAF", "Intent Executor"),
    ("0x00000088d48cf102a8cdb0137a9b173f957c6343", "SpendingLimits Policy"),
    ("0x0000003111cd8e92337c100f22b7a9dbf8dee301", "Sudo Policy"),
    ("0x0000006dda6c463511c4e9b05cfc34c1247fcf1f", "UniversalAction Policy"),
    ("0x8177451511de0577b911c254e9551d981c26dc72", "TimeFrame Policy"),
    ("0x1f34ef8311345a3a4a4566af321b313052f51493", "UsageLimit Policy"),
    ("0x730da93267e7e513e932301b47f2ac7d062abc83", "ValueLimit Policy"),
    ("0xe9eA54d063975cDee9e06b7636d5563d95a7A23C", "IntentExecution Policy"),
]

# ── Rhinestone proxy implementation contracts ──────────────────────────────
# Several Rhinestone module contracts are proxies that delegatecall to a
# separate implementation contract whose address is hardcoded as an immutable.
# These impl contracts are NOT listed in the SDK constants but must be baked
# or every call to the proxy reverts with empty data.
RHINESTONE_MODULE_IMPLS = [
    ("0xe1b629162b08b8baefa2b30ee34d6cab63580320", "SmartSession Emissary impl"),
    ("0xfd0732dc9e303f09fcef3a7388ad10a83459ec99", "Rhinestone Attester impl"),
    ("0x4da168397ba7872ea14efb0787ce4ebfc3f5b3c5", "Hook impl"),
    ("0x69b80e6ca11554ea6834b032068932c1cbace9be", "Hook impl v2"),
    ("0x5dc6eecb038ea0130fe3ce38a101e5e2cd93ce15", "SameChain Module impl"),
    ("0x194de341d4791e9b8922ee1bc018dfd1fd1b115a", "Intent Executor impl"),
]

# EIP-1967 transparent proxy implementation slot
EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

# Known Rhinestone smart account addresses to bake with full storage.
# These are counterfactual Safe proxies that are deterministically deployed
# based on the owner EOA + Rhinestone SDK config. Baking code + EIP-1967
# implementation slot ensures the delegatecall target is correct in snapshot mode.
RHINESTONE_SMART_ACCOUNTS = [
    ("0x38Baa0d0240d293723dC9C4C9732f1792297A8aF", "Rhinestone SA (ensjs-v2 / test1)"),
    ("0xC9dDA331341ffE42E6377E35EEbaCC5d4fe24e74", "Rhinestone SA (testing-2)"),
]

ENS_CONTRACTS = [
    (ETH_REGISTRY,    "ETH Registry (PermissionedRegistry)"),
    (ETH_REGISTRAR,   "ETH Registrar"),
    (REG_DATASTORE,   "Registry Datastore"),
    (PUBLIC_RESOLVER, "Public Resolver"),
    (REV_REGISTRAR,   "Reverse Registrar"),
    (ENS_REGISTRY,    "ENS Registry (v1)"),
    (NAME_WRAPPER,    "Name Wrapper"),
    (HCA_FACTORY,     "HCA Factory"),
]

# Payment tokens whose _paymentRatios slots we need to copy (for the oracle)
PAYMENT_TOKENS = [
    ("0x302edecc2b8d1f3f4625b8a825a42f9adc102e65", "MockUSDC"),
    ("0xa01e0eb02d0e92f1302e677d7ce7955b35c390d4", "MockDAI"),
]

# ── Standalone-HCA deployment (canonical Sepolia set, deployed 2026-07-30) ──
# A SEPARATE Sepolia deployment from the ENS_CONTRACTS above (different
# registrar/registry/resolver/USDC). The manager's standalone-HCA flow targets
# this set; kept in sync with `@ens-apps/smart-account`'s manifest.ts (which
# resolves most of these via ensjs) and cross-checked against contracts-v2
# `contracts/docs/addresses/sepolia.md` @ 97a5729. The shared Rhinestone
# modules (Intent Executor, etc.) are already baked by
# bake_rhinestone_infrastructure() and are reused as-is.
SH_STANDALONE_HCA_FACTORY       = "0x900ff7cf617ef9d802178b4ef480491e3a782672"
SH_STANDALONE_HCA_IMPL          = "0xaa761541620fc1a42bb701a26a9f107a9df1e904"
SH_HCA_OWNER_SESSION_VALIDATOR  = "0x5f249fca8bb4949105651146858c347e8bfb0f7e"
SH_VERIFIABLE_FACTORY           = "0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef"
# Not a standalone artifact — VerifiableFactory creates it in its constructor
# and exposes it as the `proxyLogic` immutable; must stay paired with the factory.
SH_VERIFIABLE_PROXY_LOGIC       = "0xa136bee4e37b44586242e516a39893efd54315e9"
SH_PERMISSIONED_RESOLVER_IMPL   = "0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e"
SH_ETH_REGISTRAR                = "0xa88553f454b77203b0d036a05c894d555eaaa2cc"
SH_ETH_REGISTRY                 = "0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2"
SH_DEFAULT_REVERSE_HCA_ADAPTER  = "0x7a84e241f862d73960d73c26d68c3c8f89f0b18f"
SH_USDC                         = "0x768F42455A2D082E23ceeF7d51e5787C82d67a39"

# ── StandardRentPriceOracle storage layouts (differ per deployment) ────────
# ENS-V2 mock-set oracle: _baseRatePerCp@3, _discountPoints@4, _paymentRatios@5.
# Canonical 2026-07-30 oracle: EnhancedAccessControl now reserves a 256-slot
# __gap ahead of the oracle's own variables, pushing them to 258/259/260
# (verified with `forge inspect StandardRentPriceOracle storage-layout` at
# contracts-v2 @ 97a5729). The arrays' elements live at keccak256(slot) + i
# and are baked by bake_dynamic_array below.
V2_ORACLE_ARRAY_SLOTS = (3, 4)
V2_PAYMENT_RATIOS_SLOT = 5
SH_ORACLE_ARRAY_SLOTS = (258, 259)
SH_PAYMENT_RATIOS_SLOT = 260

ZERO32 = "0x" + "0" * 64


# ── Helpers ────────────────────────────────────────────────────────────────

def rpc(method: str, params: list, retries: int = 3):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(RPC_URL, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req) as r:
                return json.load(r)
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.5 * (attempt + 1))
            else:
                raise


def keccak256(hex_data: str) -> str:
    """Compute keccak256 using the `cast` binary (Foundry)."""
    result = subprocess.run(
        ["cast", "keccak", hex_data],
        capture_output=True, text=True,
    )
    return result.stdout.strip()


def mapping_slot(key_hex: str, base_slot: int) -> str:
    """keccak256(abi.encode(key, base_slot)) — storage slot for mapping[key]."""
    key = key_hex.replace("0x", "").lower().zfill(64)
    base = hex(base_slot)[2:].zfill(64)
    return keccak256(f"0x{key}{base}")


def nested_mapping_slot(outer_key: str, inner_key: str, base_slot: int) -> str:
    """Storage slot for mapping[outer][inner] at base_slot."""
    intermediate = mapping_slot(outer_key, base_slot)
    return mapping_slot(inner_key, int(intermediate, 16))


def get_code(addr: str) -> Optional[str]:
    resp = rpc("eth_getCode", [addr, "latest"])
    code = resp.get("result", "0x")
    return code if code and code != "0x" else None


def set_code(addr: str, code: str):
    rpc("anvil_setCode", [addr, code])


def get_storage(addr: str, slot: str) -> str:
    resp = rpc("eth_getStorageAt", [addr, slot, "latest"])
    return resp.get("result", ZERO32)


def set_storage(addr: str, slot: str, val: str):
    rpc("anvil_setStorageAt", [addr, slot, val])


def copy_slot(addr: str, slot: str) -> bool:
    """Read slot from fork and write it locally. Returns True if non-zero."""
    val = get_storage(addr, slot)
    if val == ZERO32:
        return False
    set_storage(addr, slot, val)
    return True


def scan_sequential_slots(addr: str, count: int = 128) -> int:
    """Copy non-zero sequential storage slots 0..count-1."""
    copied = 0
    for i in range(count):
        slot = "0x" + hex(i)[2:].zfill(64)
        if copy_slot(addr, slot):
            copied += 1
    return copied


# ── Baking ─────────────────────────────────────────────────────────────────

def bake_code_only(addr: str, label: str):
    code = get_code(addr)
    if not code:
        print(f"  ⚠  no code at {label} ({addr}) — skipping")
        return
    set_code(addr, code)
    print(f"  ✓  {label}: code ({len(code)//2 - 1} bytes)")


def bake_with_storage(addr: str, label: str, extra_slots: list[str] | None = None):
    code = get_code(addr)
    if not code:
        print(f"  ⚠  no code at {label} ({addr}) — skipping")
        return
    set_code(addr, code)

    seq = scan_sequential_slots(addr, 128)

    extra = 0
    for slot in (extra_slots or []):
        if copy_slot(addr, slot):
            extra += 1

    print(f"  ✓  {label}: code ({len(code)//2 - 1} bytes), "
          f"{seq} sequential slots, {extra} extra mapping slots")


def bake_dynamic_array(addr: str, base_slot: int) -> int:
    """Bake a Solidity dynamic array at base_slot: its length slot + all elements."""
    slot_hex = "0x" + hex(base_slot)[2:].zfill(64)
    length_val = get_storage(addr, slot_hex)
    length = int(length_val, 16)
    if length == 0 or length > 256:
        return 0
    # The length slot itself — in the canonical oracle layout it sits at
    # slot 258/259, beyond the 0-127 sequential scan, so nothing else copies it.
    set_storage(addr, slot_hex, length_val)
    base_hash = int(keccak256(slot_hex), 16)
    copied = 0
    for i in range(length):
        if copy_slot(addr, hex(base_hash + i)):
            copied += 1
    return copied


def bake_oracle(
    addr: str,
    payment_tokens: list[tuple[str, str]] | None = None,
    ratios_slot: int = V2_PAYMENT_RATIOS_SLOT,
    array_slots: tuple[int, int] = V2_ORACLE_ARRAY_SLOTS,
):
    """Bake price oracle: sequential slots + dynamic array elements + payment ratios.

    `payment_tokens` are the tokens whose `_paymentRatios[token]` (a
    hash-addressed mapping slot NOT reachable by the sequential scan) must be
    copied so pricing survives anvil_dumpState. Defaults to the ENS-V2
    MockUSDC/DAI set; the standalone oracle passes Circle USDC.

    `ratios_slot`/`array_slots` select the deployment's storage layout — see
    the *_ORACLE_ARRAY_SLOTS / *_PAYMENT_RATIOS_SLOT comments.
    """
    tokens = payment_tokens if payment_tokens is not None else PAYMENT_TOKENS
    extra = [mapping_slot(token, ratios_slot) for token, _ in tokens]
    bake_with_storage(addr, f"Price Oracle ({addr})", extra_slots=extra)
    # The two dynamic arrays (base rates, discount points) — their elements,
    # and in the canonical layout their length slots too, are keccak/high slots
    # the sequential scan cannot reach.
    counts = {slot: bake_dynamic_array(addr, slot) for slot in array_slots}
    if any(counts.values()):
        summary = ", ".join(f"slot{s}={n} elems" for s, n in counts.items())
        print(f"       + dynamic arrays: {summary}")


def cast_call_address(addr: str, sig: str) -> Optional[str]:
    """`cast call addr 'sig()(address)'` → address, or None if zero/failed."""
    env = {**os.environ, "FOUNDRY_DISABLE_NIGHTLY_WARNING": "1"}
    result = subprocess.run(
        ["cast", "call", addr, f"{sig}()(address)", "--rpc-url", RPC_URL],
        capture_output=True, text=True, env=env,
    )
    out = result.stdout.strip()
    if out and out != "0x0000000000000000000000000000000000000000":
        return out
    return None


def get_oracle_address(registrar: str = ETH_REGISTRAR) -> Optional[str]:
    """Read `rentPriceOracle()` on a registrar (public state var / getter)."""
    return cast_call_address(registrar, "rentPriceOracle")


def bake_ens_contracts():
    # ETH Registrar — discover the price oracle via call (it's an immutable)
    bake_with_storage(ETH_REGISTRAR, "ETH Registrar")

    oracle_addr = get_oracle_address()
    if oracle_addr:
        bake_oracle(oracle_addr)
    else:
        print("  ⚠  could not determine oracle address from rentPriceOracle()")

    # FastTestETHRegistrar — MIN_COMMITMENT_AGE=0 variant used by makeV2Name fixture
    bake_with_storage(FAST_TEST_REGISTRAR, "FastTest ETH Registrar")

    # ETH Registry — nested _roles mapping at slot 2.
    # Storage layout: ERC1155Singleton (_owners@0, _operatorApprovals@1) comes before
    # EnhancedAccessControl (_roles@2, _roleCount@3, __gap@4-259) in the C3 MRO.
    # ROOT_RESOURCE=0 is the resource used for root-level role grants (e.g. ROLE_REGISTRAR).
    # Both ETH_REGISTRAR and FAST_TEST_REGISTRAR need ROLE_REGISTRAR here.
    role_slots = []
    for account in [ETH_REGISTRAR, FAST_TEST_REGISTRAR, PUBLIC_RESOLVER, REV_REGISTRAR]:
        role_slots.append(nested_mapping_slot(
            outer_key=hex(0),      # resource = ROOT_RESOURCE = 0
            inner_key=account,
            base_slot=2,           # _roles is at slot 2 (after ERC1155Singleton)
        ))
    # _roleCount at slot 3 — bake the root-resource count entry
    role_slots.append(mapping_slot(hex(0), 3))
    bake_with_storage(ETH_REGISTRY, "ETH Registry", extra_slots=role_slots)

    # Remaining ENS contracts — sequential storage is sufficient
    for addr, label in [
        (REG_DATASTORE,   "Registry Datastore"),
        (PUBLIC_RESOLVER, "Public Resolver"),
        (REV_REGISTRAR,   "Reverse Registrar"),
        (ENS_REGISTRY,    "ENS Registry (v1)"),
        (NAME_WRAPPER,    "Name Wrapper"),
    ]:
        bake_with_storage(addr, label)

    # HCA Factory, VerifiableFactory, DedicatedResolverImpl — code only
    bake_code_only(HCA_FACTORY,             "HCA Factory")
    bake_code_only(VERIFIABLE_FACTORY,      "Verifiable Factory")
    bake_code_only(DEDICATED_RESOLVER_IMPL, "Dedicated Resolver Impl")

    # Universal Resolver V2 — code only (root registry + batch gateway are immutables)
    bake_code_only(UNIVERSAL_RESOLVER, "Universal Resolver V2")

    # BatchGatewayProvider — code + sequential storage (gateway URL list)
    bake_with_storage(BATCH_GATEWAY_PROVIDER, "Batch Gateway Provider")

    # Root Registry (UserRegistry) — code + sequential storage + "eth" entry mapping slots.
    # ROOT_REGISTRY_ETH_SLOTS are hash-addressed and not reachable by sequential scan.
    bake_with_storage(ROOT_REGISTRY, "Root Registry", extra_slots=ROOT_REGISTRY_ETH_SLOTS)

    # UserRegistry implementation contract — code only (logic for UserRegistry proxies)
    bake_code_only(USER_REGISTRY_IMPL, "UserRegistry Impl")


def bake_standalone_hca():
    """Bake the standalone-HCA deployment (manager's HCA registration flow).

    The canonical 2026-07-30 Sepolia deployment, distinct from
    bake_ens_contracts(): its own registrar, registry (PermissionedRegistry —
    same `_roles@slot2` layout), resolver impl, factories, session validator,
    reverse adapter, and Circle USDC. The shared Rhinestone modules (Intent
    Executor, etc.) are baked separately and reused.
    """
    # ETH Registrar — code + storage; discover + bake its price oracle.
    bake_with_storage(SH_ETH_REGISTRAR, "Standalone ETH Registrar")
    sh_oracle = get_oracle_address(SH_ETH_REGISTRAR)
    if sh_oracle:
        # The standalone oracle prices in Circle USDC, so its ratio slot (not the
        # MockUSDC/DAI ones) must be baked — at the canonical layout's slots.
        bake_oracle(
            sh_oracle,
            payment_tokens=[(SH_USDC, "MockUSDC")],
            ratios_slot=SH_PAYMENT_RATIOS_SLOT,
            array_slots=SH_ORACLE_ARRAY_SLOTS,
        )
    else:
        print("  ⚠  could not determine standalone oracle from rentPriceOracle()")

    # ETH Registry (PermissionedRegistry) — nested _roles@slot2 (see the note in
    # bake_ens_contracts): the registrar must hold ROLE_REGISTRAR at ROOT_RESOURCE.
    role_slots = [
        nested_mapping_slot(outer_key=hex(0), inner_key=SH_ETH_REGISTRAR, base_slot=2),
        mapping_slot(hex(0), 3),  # _roleCount at the root resource
    ]
    bake_with_storage(SH_ETH_REGISTRY, "Standalone ETH Registry", extra_slots=role_slots)

    # Reverse adapter — code + storage (trustedHCAImplementations mapping etc.).
    bake_with_storage(SH_DEFAULT_REVERSE_HCA_ADAPTER, "DefaultReverseRegistrarAdapter")

    # Session validator — code + storage; then bake the intent executor +
    # gas-refund paymaster it points at (public immutables), discovered on-chain.
    bake_with_storage(SH_HCA_OWNER_SESSION_VALIDATOR, "HCAOwnerAndSessionValidator")
    intent_executor = cast_call_address(SH_HCA_OWNER_SESSION_VALIDATOR, "INTENT_EXECUTOR")
    if intent_executor:
        bake_code_only(intent_executor, "HCA Intent Executor (validator immutable)")
    gas_refund_paymaster = cast_call_address(
        SH_HCA_OWNER_SESSION_VALIDATOR, "GAS_REFUND_PAYMASTER"
    )
    if gas_refund_paymaster:
        bake_code_only(gas_refund_paymaster, "HCA Gas Refund Paymaster (validator immutable)")

    # Factories + impls — code only (logic; per-account storage lives in proxies).
    bake_code_only(SH_STANDALONE_HCA_FACTORY,     "StandaloneHCAFactory")
    bake_code_only(SH_STANDALONE_HCA_IMPL,        "StandaloneHCAImplementation")
    bake_code_only(SH_VERIFIABLE_FACTORY,         "Standalone VerifiableFactory")
    bake_code_only(SH_VERIFIABLE_PROXY_LOGIC,     "Standalone VerifiableFactory proxy logic")
    bake_code_only(SH_PERMISSIONED_RESOLVER_IMPL, "Standalone PermissionedResolver impl")

    # MockUSDC — payment token for the standalone route. Code +
    # sequential storage; balances/allowances are minted per-account at
    # fund-time (see fund scripts), so no mapping slots to copy here.
    bake_with_storage(SH_USDC, "MockUSDC (standalone)")


def bake_rhinestone_infrastructure():
    """Bake Safe/Rhinestone infrastructure needed for smart account execution."""
    # Core Safe contracts — code only (logic contracts, storage lives in each proxy)
    for addr, label in [
        (SAFE_PROXY_FACTORY,     "SafeProxyFactory"),
        (SAFE_SINGLETON,         "Safe Singleton"),
        (SAFE_7579_LAUNCHPAD_V1, "Safe7579 Launchpad V1"),
        (SAFE_7579_ADAPTER_V1,   "Safe7579 Adapter V1"),
        (SAFE_7579_LAUNCHPAD_V2, "Safe7579 Launchpad V2"),
        (SAFE_7579_ADAPTER_V2,   "Safe7579 Adapter V2"),
    ]:
        bake_code_only(addr, label)

    # All Rhinestone module/validator/policy contracts (code only).
    for addr, label in RHINESTONE_MODULES:
        bake_code_only(addr, label)

    # Proxy implementation contracts (hardcoded immutables inside the proxies above).
    for addr, label in RHINESTONE_MODULE_IMPLS:
        bake_code_only(addr, label)

    # Known Rhinestone smart accounts — code + sequential slots + EIP-1967 impl pointer.
    # Without the EIP-1967 slot the proxy delegates to address(0) and every call fails.
    for addr, label in RHINESTONE_SMART_ACCOUNTS:
        bake_with_storage(addr, label, extra_slots=[EIP1967_IMPL_SLOT])


# ── Main ───────────────────────────────────────────────────────────────────

print("EVM infrastructure (code only):")
for addr, label in INFRA_CONTRACTS:
    bake_code_only(addr, label)

print("\nERC-4337 contracts (code only):")
for addr, label in ERC4337_CONTRACTS:
    bake_code_only(addr, label)

print("\nENS contracts (code + storage):")
bake_ens_contracts()

print("\nStandalone-HCA deployment (code + storage):")
bake_standalone_hca()

print("\nSafe / Rhinestone infrastructure:")
bake_rhinestone_infrastructure()

print("\nDone.")
