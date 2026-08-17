# HCA Time-Boxed Owner Sessions (NOT SmartSessions)

How the ENS Manager app makes HCA (Hidden Contract Account) registration flows
run **prompt-free after a single signature**.

> ⚠️ **The HCA does NOT use SmartSessions or Emissary.** Those modules are not
> installed on the account (verified on-chain — see §1). What we call a "session"
> here is **not** an ERC-7579 SmartSessions session. It is simply an **ephemeral
> key added as a time-boxed _owner_** of the HCA's `OwnableValidator`. Throughout
> this doc, "session" / "ENABLE" / `Rhinestone*Session*` always means this
> owner-key mechanism, never the SmartSessions module.

> TL;DR — The user signs **once** to add an ephemeral key as a temporary HCA
> owner (the ENABLE signature). The SDK then signs every subsequent registration
> Intent with that ephemeral key — no further wallet prompts — until the owner
> expires (1 week). No SmartSessions/Emissary, no per-action scoping: it is a
> plain extra owner with a `uint48` expiration.

---

## 1. Why this model

A Rhinestone HCA is validated by **HCAModule**, an `OwnableValidator` deployed
at `0x5049ecBd4d961aE6DFEED9b7ccCe7f026454970E` (Sepolia). It is a multi-owner,
k-of-n validator where **each owner carries a `uint48` expiration**. A signer is
valid iff it exists as an owner **and** `block.timestamp <= expiration`.

We originally wanted the proper **SmartSessions / Emissary** scoped-session
approach (per-action permissions, register-only scope), but it is **not
available** for an HCA:

- The SDK rejects `experimental_sessions` for HCA accounts
  (`AccountConfigurationNotSupportedError`).
- There is **no SmartSessions validator on the account to enable a session
  against** — the HCA installs only `{HCAModule validator, IntentExecutor}` (see
  next subsection).
- The HCA **locks its module set** (`installModule` / `uninstallModule` revert),
  so we cannot install a SmartSessions validator ourselves either.

So SmartSessions is off the table. The only thing the HCA lets us change is the
owner list on its already-installed validator: `OwnableValidator.updateConfig(...)`
is a **state update on the existing validator** — not a module install — so the
HCA can add / remove owners on itself. That's the lever this whole mechanism is
built on, and it's why the result is a plain time-boxed owner rather than a
scoped session.

```solidity
// rhinestonewtf/ens-modules — src/hca-module/base/OwnableValidator.sol
struct Owner { address addr; uint48 expiration; }   // max = permanent
function updateConfig(uint256 newThreshold, Owner[] ownersToAdd, address[] ownersToRemove)
```

`HCAModule.sol` only constrains `owners[0]` to be permanent **at install time**.
Owners _added later_ via `updateConfig` may have a finite expiration — exactly
what we want for an ephemeral session key.

### What the HCA actually installs (no SmartSessions / Emissary)

The HCA's module set is **fixed at construction and frozen for life** — there is
NO SmartSessions validator and NO Emissary, neither installed dynamically nor
baked in as a default. Verified on Sepolia with `cast` against the live account
`0xc4991693c3cd15a9724b3c61119a48f3f26366c8` and its implementation
`0x8B6e553709C960576FA6F3Ed7d062047E8cD2B70` (read straight from the
implementation's creation-bytecode ABI-encoded constructor args):

| Slot | Module | Address (Sepolia) | How it's set |
|------|--------|-------------------|--------------|
| `_DEFAULT_VALIDATOR` (type 1) | **HCAModule** (`OwnableValidator`) | `0x5049ecBd4d961aE6DFEED9b7ccCe7f026454970E` | Immutable ctor arg `defaultValidator_` |
| `_DEFAULT_EXECUTOR` (type 2) | **Rhinestone IntentExecutor** | `0x00000000005ad9ce1f5035fd62ca96cef16adaaf` | Immutable ctor arg `intentExecutor_` |
| hook (type 4) | _none_ | `address(0)` | `getActiveHook()` → `0x0` |

Other ctor args: `entryPoint_` = `0x0000000071727De22E5e9d8BAf0edAc6f37da032`
(canonical 4337 v0.7 EntryPoint), `hcaFactory_` =
`0x358680728dedb552adaa9f5eb5d4395b291cf943`, `validatorInitData_` =
`(threshold=1, owners=[{address(1), permanent}])` template.

Evidence (all reproducible with the addresses above):

- `installModule(...)` and `uninstallModule(...)` both revert with `0xca962ccf`
  (= `NoModuleChangeAllowed()`) — from EntryPoint, owner, or any caller. The set
  cannot change post-deploy.
- The canonical SmartSessions module `0x00000000002B0eCfbD0496EE71e01257dA0E37DE`
  is absent: `SmartSessions.isInitialized(HCA)` → `false`,
  `isModuleInstalled(1|4, SmartSessions)` → `false`, **0 occurrences** of its
  address (and 0 of `"emissary"`/`"smartsession"`) anywhere in the account's
  creation OR deployed bytecode/metadata.
- `HCAModule.isInitialized(HCA)` → `true` confirms HCAModule is the live
  validator (it's the immutable default, so it does NOT show up in the
  ERC-7579 sentinel list / `isModuleInstalled`).

"Emissary" _does_ appear in the `ens-modules` repo, but only in **test
scaffolding** (`test/Base.t.sol` imports `@rhinestone/compact-utils/.../Emissary.sol`
for the Compact settlement test env) — never under `src/hca` or `src/hca-module`,
and never on the account.

This is exactly _why_ the owner-key model is the only option: with no
SmartSessions validator on-chain and `installModule` locked, the sole lever for a
prompt-free session is adding a time-boxed owner via `updateConfig`.

### Security tradeoff (acknowledged)

An added owner is a **full HCA owner**: it can authorize **any** Intent the HCA
can execute (including moving funds), bounded **only** by its on-chain `uint48`
expiration. There is **no per-action scoping** at this layer — `OwnableValidator`
has none. The ephemeral key lives in `localStorage` and must be assumed
exfiltratable, so we keep its lifetime short (**1 week**) and support explicit
revocation.

Mitigating facts:

- The ENS **name is still registered to the EOA** — the `register` call's `owner`
  arg is the EOA, not the HCA.
- The EOA remains the **permanent primary owner** (`owners[0]`, expiration =
  `max`). We only **add** a temporary co-owner; we never touch `owners[0]`.

---

## 2. The two signatures a user sees

For a **first** registration in a fresh session window:

1. **ENABLE** — owner-signed, sponsored Intent calling `updateConfig` to add the
   ephemeral key as a time-boxed co-owner. _This is the only session signature._
2. **EIP-2612 permit** — gasless token approval for the payment (registration's
   own concern, unrelated to sessions).

Everything else — `commit`, resolver deploy, `register` — is **session-signed,
prompt-free**.

For a **subsequent** registration within the 1-week window: the stored session
is reused, so the user only sees the permit (the ENABLE step is skipped — see
§6).

---

## 3. Lifecycle

```
ENABLE   updateConfig(1, [{ addr: ephemeralKey, expiration: now + 1w }], [])  ← 1 wallet signature
USE      sendTransaction({ ..., signers: { type:'owner', kind:'ecdsa', accounts:[ephemeralAccount] } })  ← prompt-free
RENEW    updateOwnerExpiration(ephemeralKey, now + 1w)  (optional — extend the SAME key, see below)
EXPIRE   block.timestamp > expiration  → key auto-invalid on-chain (no tx needed)
REVOKE   updateConfig(1, [], [ephemeralKey])  (optional, explicit)
```

`threshold` stays at **1** (1-of-n): either the permanent EOA owner _or_ the
ephemeral key can authorize an Intent.

### Renewal: `updateOwnerExpiration` vs. a fresh ENABLE (avoids owner accretion)

> ⚠️ **Observed on the live HCA:** repeated ENABLEs accumulate owners. The live
> account currently holds the permanent EOA at `owners[0]` **plus several finite
> ephemeral owners** (one per ENABLE) — verified via
> `cast call $MODULE "getOwners(address)" $HCA`. Each `createRhinestoneSession`
> mints a NEW ephemeral key and a NEW `updateConfig` add-owner call, so a new row
> is appended every time (old rows linger until they expire — expiry does NOT
> evict them from storage; `getOwnersCount` still counts expired owners, capped at
> `MAX_OWNERS = 32`).

`OwnableValidator` also exposes a second, cheaper lever the current code does
**not** use:

```solidity
// rhinestonewtf/ens-modules — src/hca-module/base/OwnableValidator.sol
function updateOwnerExpiration(address owner, uint48 newExpiration) public moduleIsInitialized
```

`updateOwnerExpiration` extends (or reduces) the expiry of an **existing** owner
in place — internally a `remove + re-add` of the same address, so it does NOT
grow the owner set. It reverts `OwnerNotFound` if the address isn't already an
owner, and `ExpirationInPast` if `newExpiration <= block.timestamp` (unless
`type(uint48).max`).

Two valid renewal strategies, with different tradeoffs:

| Strategy | Call | Reuses key? | Owner set grows? | Wallet prompt? |
|----------|------|-------------|------------------|----------------|
| **Fresh ENABLE** (current behaviour) | `updateConfig(1, [{newKey, now+1w}], [])` | no — new ephemeral key | **yes**, +1 row per renewal | yes (owner-signed) |
| **Extend in place** | `updateOwnerExpiration(sameKey, now+1w)` | yes — same stored key | no | yes (owner-signed) |

Both are owner-signed (one wallet signature), so neither is "free." The
in-place extension is preferable for **storage hygiene** — it keeps a single
ephemeral owner alive rather than leaving a trail of expired-but-still-stored
rows that count toward `MAX_OWNERS`. It does mean a longer-lived key on disk, so
if you adopt it, pair it with an explicit REVOKE on logout/rotation.

> 🔭 **Not yet wired.** The app always takes the **Fresh ENABLE** path (a stored
> session is reused only while still valid — see §6 — and once expired a brand
> new key+owner is minted). Switching reuse-on-expiry to `updateOwnerExpiration`
> would require: (1) a `buildExtendSessionOwnerCall({ sessionKeyAddress, validUntil })`
> builder alongside `buildAddSessionOwnerCall`; (2) a session-storage path that
> keeps the same `sessionPrivateKey` and only bumps `validUntil`; and (3) an
> optional periodic REVOKE/cleanup pass for stale owners. Tracked as a future
> improvement; the current model is correct, just less storage-frugal.

---

## 4. Code map

### `packages/smart-account/src/providers/rhinestone/`

| File | Responsibility |
|------|----------------|
| `registration-policy.ts` | `buildAddSessionOwnerCall({ sessionKeyAddress, validUntil })` → encodes the `updateConfig` add-owner call to `ENS_HCA_MODULE`. Exports `ENS_HCA_MODULE` and `REGISTRATION_SESSION_VALIDITY_SECONDS` (7 days). Guards against a non-finite (`>= maxUint48`) expiration. |
| `session.ts` | `createRhinestoneSession(...)` — generates the ephemeral key, sends the one sponsored ENABLE Intent, `waitForExecution(tx, /* acceptPreconfirmation */ true)`, returns the stored-session record. `restoreRhinestoneSession(...)` — expiry-only validation (no signature). |
| `types.ts` | `RhinestoneStoredSession = BaseStoredSession & { provider: 'rhinestone' }`. No enable-signature / digest fields — the add-owner Intent _is_ the enable. `isRhinestoneSession()` guard. |
| `session-storage.ts` | `localStorage` persistence keyed by HCA address. Key `ens-sessions-v5`. `getValidSessionForAccount({ accountAddress, ownerAddress, chainId })` pins all three identifiers and evicts on mismatch/expiry. |

**The stored session record** (`RhinestoneStoredSession`):

```ts
{
  id, provider: 'rhinestone',
  sessionKeyAddress,        // ephemeral owner address (on-chain)
  sessionPrivateKey,        // ephemeral key — signs Intents
  smartAccountAddress,      // HCA
  ownerAddress,             // EOA
  chainId, validUntil,      // expiry (unix seconds) — mirrors on-chain expiration
  createdAt,
}
```

### `packages/transaction-manager/src/`

| File | Responsibility |
|------|----------------|
| `types/signer.types.ts` | `RhinestoneSessionContext = { sessionAccount: Account }`. `RhinestoneSigner.session?` — when present, Intents are session-signed; when absent, owner-signed. |
| `actors/warp-transport.actor.ts` | If `signer.session` is set, passes `signers: { type:'owner', kind:'ecdsa', accounts:[signer.session.sessionAccount] }` to the SDK `sendTransaction`. The SDK signs with the ephemeral account through the normal owner-validator path → no prompt. |

### `apps/manager/src/lib/smart-account/`

| File | Responsibility |
|------|----------------|
| `actors/build-session-signer.ts` | `buildSessionContext({ session })` → `{ sessionAccount: privateKeyToAccount(session.sessionPrivateKey) }`. |
| `actors/session.actors.ts` | `resolveSessionActor(...)` — reuse a valid stored session for THIS HCA, else `createSessionActor(...)` (the ENABLE signature) + `saveSession`. Also `checkExistingSessionActor` / `restoreSessionActor`. |
| `SmartAccountContext.tsx` | React provider. Holds `activeSession`, `isEnablingSession`, `sessionError`. Exposes `hasActiveSession` and `enableSession()`. Builds the `RhinestoneSigner` (with `session` attached when active). Hydrates `activeSession` from storage on owner change/mount. |
| `sessionGate.ts` | `needsSessionBeforeRegistration(account) = account.signer?.type === 'rhinestone' && !account.hasActiveSession`. Shared by every entry point. (`sessionGate.test.ts` covers it.) |

### `apps/manager/src/features/wallet/`

| File | Responsibility |
|------|----------------|
| `hooks/useSmartSessionGate.tsx` | Reusable gate. `const { gate, sessionModal } = useSmartSessionGate()`. `gate(onProceed)` — if `needsSessionBeforeRegistration`, opens the modal and defers `onProceed` until ENABLE succeeds; otherwise runs immediately. Render `{sessionModal}` in the tree. |
| `components/EnableSessionModal.tsx` | The ENABLE prompt UI (shows the single signature is for enabling the session). |

---

## 5. Gating the registration flows

There are **two** registration entry points, both gated through the shared
hook/decision so behaviour is identical:

- **register-v2 (active flow):** `features/register-v2/workflow/pricing/components/PaymentCard.tsx`
  uses `useSmartSessionGate()` and wires `onNext={() => gate(openTokenPicker)}`,
  rendering `{sessionModal}`.
- **register (v1):** `features/register/pages/RegistrationPage.tsx` renders
  `EnableSessionModal` and resumes via its session-gate hook.

> ⚠️ **Render-path gotcha.** The live register-v2 dispatcher is reached via
> `PaymentCard` → `TokenPickerContent` (rendered from `PricingStep`). The
> **`ConfirmPurchase` component** in
> `register-v2/workflow/pricing/components/ConfirmPurchase.tsx` has **no
> importers** and is off the live render path — do not wire gates into it. Note
> that the _same file_ also exports `ConfirmPurchaseBase`, which **is** imported
> by the renew flow (`features/renew/workflow/pricing/components/ConfirmPurchase.tsx`),
> so the file itself is not dead — only the `ConfirmPurchase` export. Always
> verify the render path before adding a UI gate.

### Gate flow

```
user clicks "Next"
  └─ gate(onProceed)
       ├─ needsSession?  no  → onProceed()  (EOA path, or session already active)
       └─ needsSession?  yes → open EnableSessionModal
                                  └─ onEnableSession → account.enableSession()
                                       ├─ returns a session-attached Signer  → close modal, onProceed()
                                       └─ returns null (error) → modal stays open, shows sessionError
```

### The stale-closure fix

`enableSession()` **returns the session-attached `Signer` immediately** rather
than relying on the next React render of `account.signer`. The caller starts the
flow in the same tick with the fresh signer, avoiding the race where the
flow would otherwise capture the stale, session-less signer.

---

## 6. Session reuse & hydration

- `SmartAccountContext` hydrates `activeSession` from `localStorage` whenever the
  owner OR the HCA address changes (incl. initial mount), via
  `getValidSessionForAccount({ accountAddress, ownerAddress, chainId })`. So a
  **page reload with a valid stored session** sets `hasActiveSession = true` and
  the ENABLE modal is **skipped** — the second registration within the week
  needs no enable signature.
- Reuse is **scoped to the exact HCA** (account + owner + chain). An owner-keyed
  lookup alone could return a session whose ephemeral key is _not_ an owner of
  the current HCA; that row is evicted and a fresh session created instead.
- `validUntil` (stored) mirrors the on-chain `expiration`. The client-side expiry
  check is a UX preflight; the real boundary is enforced on-chain by the owner's
  `uint48 expiration`.

### The hydration-key fix (reload re-prompt bug)

> 🐞 **Bug (fixed):** on a page reload mid-registration, clicking "Pay with
> stablecoins" re-prompted ENABLE **every time**, even though a valid session was
> in `localStorage` — and each reload-then-register minted a **new on-chain
> owner** (observed: multiple ephemeral owners on the live HCA).

Root cause: the hydration effect's dedupe ref keyed **only on the owner address**.
On reload the owner (from the connected wallet) resolves a render *before* the HCA
`accountAddress` does. So the effect ran once while `accountAddress` was still
`null` (the account-scoped lookup was skipped → session read as inactive), then
the owner-only ref guard **short-circuited the re-run** once the account arrived
— leaving `hasActiveSession = false` forever.

Fix: the guard key now includes **both** owner and account
(`sessionHydrationKey(ownerAddress, accountAddress)` in `sessionGate.ts`), so the
effect re-runs and performs the lookup once both are known. Covered by
`sessionGate.test.ts` ("CHANGES once the HCA address arrives").

---

## 7. Key facts / constants

**On-chain (Sepolia) — the HCA module set:**

| Thing | Value |
|-------|-------|
| HCA account (proxy) | `0xc4991693c3cd15a9724b3c61119a48f3f26366c8` (`accountId() = "ens-hca.1.0.0"`) |
| HCA implementation | `0x8B6e553709C960576FA6F3Ed7d062047E8cD2B70` (this account's ERC-1967 slot — see drift note ⬇) |
| Default validator (type 1) | **HCAModule** `0x5049ecBd4d961aE6DFEED9b7ccCe7f026454970E` (immutable) |
| Default executor (type 2) | **IntentExecutor** `0x00000000005ad9ce1f5035fd62ca96cef16adaaf` (immutable) |
| Hook (type 4) | _none_ — `getActiveHook()` = `0x0` |
| SmartSessions / Emissary | **NOT installed** (0 occurrences in bytecode; `installModule` reverts `0xca962ccf`) |
| EntryPoint | `0x0000000071727De22E5e9d8BAf0edAc6f37da032` (4337 v0.7) |
| HCAFactory | `0x358680728dedb552adaa9f5eb5d4395b291cf943` (matches the SDK's `HCA_FACTORY_ADDRESS`) |

> ⚠️ **Implementation-address drift (SDK vs. deployed).** The Rhinestone SDK
> hardcodes a `HCA_IMPLEMENTATION_ADDRESS` (currently
> `0x7c2cC1e499a87ab480Df154e05164cD56D05d570` in `src/accounts/hca.ts`) used only
> for CREATE3 address _prediction_. The **live account `0xc499…` was deployed with
> an OLDER implementation**: its ERC-1967 implementation slot
> (`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) reads
> `0x8B6e…2B70` — the value in the table above, confirmed via
> `eth_getStorageAt`. The **HCAFactory matches** (`0x3586…f943`), so CREATE3
> address derivation is unaffected; the implementation pointer simply differs
> because the SDK bumped its impl after this account was created. This is expected
> drift, not a misconfiguration — but if you re-derive or re-deploy with a current
> SDK, expect a different implementation behind the proxy.

**App / SDK config:**

| Thing | Value |
|-------|-------|
| Session lifetime | `7 * 24 * 60 * 60` s (1 week) |
| `localStorage` key | `ens-sessions-v5` |
| Threshold after add | `1` (1-of-n) |
| Name owner after register | the **EOA** (e.g. `0x205d2686da3Bf33f64C17f21462c51B5eaD462CF`) |
| Permanent primary owner | EOA = `owners[0]`, expiration = `max` |

---

## 8. Verification checklist

- [ ] First registration shows exactly **2** wallet signatures: ENABLE
      (`updateConfig` add-owner) + EIP-2612 permit.
- [ ] `commit` / resolver-deploy / `register` are prompt-free (SDK params show
      `signers` present).
- [ ] `register` calldata `owner` arg = the EOA (name owned by EOA, not HCA).
- [ ] Second registration within the week shows **1** signature (permit only);
      no ENABLE modal (session hydrated from storage).

### On-chain module-set checks (`cast`, Sepolia)

```bash
HCA=0xc4991693c3cd15a9724b3c61119a48f3f26366c8
MODULE=0x5049ecBd4d961aE6DFEED9b7ccCe7f026454970E
SMARTSESSIONS=0x00000000002B0eCfbD0496EE71e01257dA0E37DE
RPC=https://ethereum-sepolia-rpc.publicnode.com

cast call $HCA "accountId()(string)" --rpc-url $RPC            # "ens-hca.1.0.0"
cast call $MODULE "isInitialized(address)(bool)" $HCA --rpc-url $RPC   # true
cast call $HCA "getActiveHook()(address)" --rpc-url $RPC       # 0x0 (no hook)
cast call $HCA "installModule(uint256,address,bytes)" 1 0x000000000000000000000000000000000000dEaD 0x --rpc-url $RPC  # revert 0xca962ccf = NoModuleChangeAllowed()
cast call $SMARTSESSIONS "isInitialized(address)(bool)" $HCA --rpc-url $RPC   # false

# Implementation pointer (ERC-1967 slot) — confirms the deployed impl (drift note §7):
cast storage $HCA 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url $RPC  # 0x..8B6e553709C960576FA6F3Ed7d062047E8cD2B70

# Owner set — EOA permanent (expiration = type(uint48).max = 281474976710655) +
# finite ephemeral owners, one per ENABLE (owner accretion, see §3 Renewal):
cast call $MODULE "getOwners(address)((address,uint48)[])" $HCA --rpc-url $RPC
# e.g. [(0x205d2686…462CF, 281474976710655), (0x71E7…184F, 1782732230), …]
```

### Owner-set hygiene check

- [ ] `getOwners(HCA)` shows `owners[0]` = EOA with expiration
      `281474976710655` (= `type(uint48).max`, permanent).
- [ ] Every other owner is a finite-expiry ephemeral session key. A growing
      count of these across renewals is expected with the current **Fresh
      ENABLE** model (§3) — switch to `updateOwnerExpiration` to keep it to one.
