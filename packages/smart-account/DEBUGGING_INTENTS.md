# Debugging Rhinestone HCA intents

Field notes for the standalone-HCA registration flow (`src/providers/rhinestone/`).
Written after several production bugs that all surfaced as the same useless
error. None of them were signature problems.

## 1. `InvalidSignature()` almost never means the signature is wrong

A failed intent comes back from the orchestrator as:

```
Failed to submit transaction: Simulation failed: InvalidSignature()
  errorSelector: 0x8baa579f  category: INVALID_SIGNATURE
```

`0x8baa579f` is the **emissary re-wrapping whatever the validator actually
reverted with**. Both real bugs so far were policy failures with valid
signatures. Do not start debugging signing — get the inner revert first.

## 2. Get the inner revert with `cast`, no fork needed

The error payload contains everything required to replay the call: `call.to`,
`call.data`, `details.relayer`, `details.blockNumber`, and
`details.stateOverride`. Feed them to `cast call --trace` against an archive
RPC:

```bash
cast call <call.to> "$(cat calldata.hex)" \
  --from <details.relayer> \
  --block <details.blockNumber> \
  --rpc-url "$ARCHIVE_RPC" \
  --trace \
  --override-balance <relayer>:0xffffffffffffffffffffffffffffffff \
  --override-state-diff <token>:<slot>:<value>,<token>:<slot>:<value>
```

Notes:
- Use `--override-state-diff`, **not** `--override-state` — the latter replaces
  the account's entire storage and will wipe unrelated token state.
- A stale local Anvil fork will fail with `historical state ... is not
  available` / archive-token 403 once the upstream provider prunes. Point at an
  archive endpoint and pass `--block` instead of keeping a long-lived fork.
- The trace bottoms out at the real revert, e.g. `← [Revert] custom error
  0xe50c42ea`.

## 3. Decode the selector against the validator source

`HCAOwnerAndSessionValidator.sol` is **not on contracts-v2 `main`** — it lives on
the HCA PR branch. Fetch that one file; do not grep the repo (it will match
thousands of lines in `deployments/` and `lib/`):

```bash
git -C ../contracts-v2 fetch origin 'refs/pull/362/head:refs/remotes/pr/362'
git -C ../contracts-v2 show refs/remotes/pr/362:contracts/src/hca/HCAOwnerAndSessionValidator.sol > /tmp/HCAV.sol
rg -o "error \w+\([^)]*\);" /tmp/HCAV.sol | sed 's/error //; s/;//' \
  | while read -r s; do printf "%-42s %s\n" "$s" "$(cast sig "$s")"; done
```

Known selectors:

| selector | error | meaning |
|---|---|---|
| `0xe50c42ea` | `PolicyRuleFailed()` | a hardcoded policy argument check failed |
| `0xde1834f2` | `ActionNotAllowed(address,bytes4)` | target/selector outside the allowlist |
| `0x0672e151` | `GasRefundNotAllowed()` | quoted executor refund exceeded the session caps |
| `0x815e1d64` | `InvalidSigner()` | a bad key **or** a session that was never enabled — see below |
| `0x9bdfc59f` | `InvalidSessionData()` | payload is not the Smart Session USE form |
| `0x037b5679` | `CallerNotIntentExecutor()` | presented by someone other than the IntentExecutor |
| `0x1fd05a4a` | `SessionExpired()` | `validUntil` elapsed |

A trace only ever reveals the **first** violation. After fixing one, re-check
the remaining calls against the policy loop rather than assuming.

`InvalidSigner()` is the misleading one — it has three call sites in
`_validateFixedSessionPayload` alone, and only the last is an actual key
mismatch. **Use the trace depth to tell them apart:** if it reverts *before*
`5aa6d3a9` (`ownerAndSessionNonce`) and *before* `ecrecover`, nothing was
recovered and it is the very first check,
`config.sessionKey == address(0)` — an unenabled session (§7), not a bad key.

## 4. The policy pins exact calldata — not just arguments

`_checkResolverDeployment` does not inspect `deployProxy`'s arguments. It
**reconstructs the whole calldata and compares keccak hashes**:

```solidity
bytes[] memory setters = new bytes[](0);            // hardcoded EMPTY
expectedInitData = abi.encodeCall(initialize, (account, ALL_ROLES, setters));
expectedCallData = abi.encodeCall(deployProxy, (PERMITTED_RESOLVER_IMPL, salt, expectedInitData));
if (keccak256(callData) != keccak256(expectedCallData)) revert PolicyRuleFailed();
```

`authorizeNameRoles` is pinned the same way, to
`(hex"00", ALL_ROLES, owner, true)` — which is why the root grant cannot be
narrowed to a per-name resource even though the resolver supports it.

Consequences:
- Record writes (`setAddr` `0x8b95dd71`, `setText` `0x10f13a8c`, …) **must** be
  standalone calls. Folding them into `initialize`'s `setters` is rejected
  before the resolver ever executes, even though the resolver would happily run
  them during initialization.
- Any change to how the resolver is deployed or initialized breaks this check.
  Assert new calldata against a policy-derived keccak in tests.

## 5. Reproduce end-to-end with a real signed intent

You can build and submit a genuinely signed intent outside the app — drive the
SDK exactly as the app does. No need to hand-roll the quote schema.

```ts
const init = await initializeRhinestoneAccount({
  ownerAccount: owner, eoaAddress: owner.address, chain: sepolia,
  publicClient: pc, rhinestoneApiKey: API_KEY,
})
const account = init.value.client        // NOT .account
const hca = init.value.address

const sess = await createDestinationSession({
  rhinestoneAccount: account, publicClient: pc, chain: sepolia,
  hca, resolver, sessionAccount, validUntil,
  alreadyDeployed: init.value.alreadyDeployed,
})

// leg 1: enable + commit (carries enableData), leg 2: reveal (session only)
const tx = await account.sendTransaction({
  sourceChains: [sepolia], targetChain: sepolia,
  calls, sponsored: { gas: false, bridging: false, swaps: false },
  feeAsset: 'USDC', tokenRequests: [], gasLimit: HCA_LEG_GAS_LIMITS.register,
  signers: { type: 'experimental_session', session, enableData?, verifyExecutions: true },
})
await account.waitForExecution(tx, false)
```

Gotchas that will silently invalidate the test:

- **Use a fresh owner.** The resolver is per-HCA, not per-name — an account that
  has registered before already has a deployed resolver and skips `deployProxy`
  entirely, so it cannot reproduce fresh-deploy bugs.
- **Fund the HCA with USDC directly** to skip the EIP-2612 permit leg when the
  permit isn't what you're testing.
- Wait `MIN_COMMITMENT_AGE` (read it, don't hardcode) between the two legs.
- You do not need a *successful* registration to clear a policy bug: if the
  batch fails on something later (e.g. a missing commitment), the policy check
  already passed.

## 6. Session caps live in the salt

`MAX_REFUND_AMOUNT` / `MAX_REFUND_GAS_OVERHEAD` / `MAX_REFUND_EXCHANGE_RATE`
(`manifest.ts`) are baked into the destination session salt via
`computeDestinationSessionSalt`, so the salt — and therefore the permissionId —
changes when they do. A quoted refund above the cap reverts with
`GasRefundNotAllowed()`, again surfaced as `InvalidSignature()`.

When reading a failing intent's fields, note the big `uint256` next to the
account address is the **nonce**, not the salt. Confirm with `cast to-dec`
before comparing it against anything.

## 7. The session-enable proof belongs on EVERY commit

`enableData` (the `SessionEnableProof`) is what selects the validator's
first-use policy path. It is tempting to omit it once the session is enabled
on-chain — the handoff doc says to, and `experimental_isSessionEnabled` exists
to check. Doing so has broken production twice, in two *different* ways, both
arriving as `InvalidSignature()`:

| batch | without the proof | inner revert |
|---|---|---|
| carries `permit` + `transferFrom` | falls through to `_checkRegistrationExecutions`, whose payment-token branch allows only `approve` | `ActionNotAllowed(USDC, 0xd505accf)` `0xde1834f2` |
| no funding pair | SDK signs mode `0x02`, but `_sessions[hca][permissionId]` is still empty on a session's first use | `InvalidSigner()` `0x815e1d64` |

Two independent conditions require the proof — *"we are funding"* and *"the
session is not enabled yet"* — so gating on either one alone leaves the other
broken. That is exactly how the second bug was introduced while fixing the
first. **Attach it unconditionally:**

- **idempotent** — `_enableSessionFor` rewrites the same slot with identical
  values; there is no "already enabled" revert.
- **reusable** — `_validateSessionEnableProof` checks only `validUntil` and the
  account's session nonce, and nothing increments that nonce outside
  `revokeSessions()`.
- **no wallet prompt** — `buildHcaSessionEnablePayload` rebuilds it from the
  authorization signature captured once at the session gate. The user still
  signs the authorization exactly once.

The only cost is one extra `enableSessionWithRefund` per commit, over mostly
warm slots.

### Read the mode byte first

`data[0]` of the validator signature tells you which path the failing intent
took:

| mode | constant | meaning |
|---|---|---|
| `0x01` | `FIXED_SESSION_MODE` | session only |
| `0x02` | `FIXED_SESSION_REFUND_MODE` | session + gas refund — assumes ALREADY enabled |
| `0x03` | `FIXED_SESSION_PERMIT2_MODE` | cross-chain, session only |
| `0x04` | `FIXED_SESSION_PERMIT2_ENABLE_MODE` | cross-chain first use, carries the proof |
| `0x05` | `FIXED_SESSION_REFUND_ENABLE_MODE` | same-chain first use, carries the proof |

`0x02` against a session that was never enabled is the `InvalidSigner()` row
above. The permissionId is `data[1:33]` of the same envelope, so check it
directly:

```bash
cast call <validator> 'isPermissionEnabled(address,bytes32)(bool)' <hca> <permissionId> \
  --block <details.blockNumber> --rpc-url "$ARCHIVE_RPC"
```

**`false` at the failing block and `true` at `latest` is the signature of this
bug**, and explains why it looks intermittent: some later run enables the
session, so every subsequent commit passes and only the first one under a fresh
session fails. A registration funded entirely from leftover HCA balance is the
usual trigger, because it needs no permit and so never took the funding branch.

### The SDK strips the proof once the session is enabled

Attaching `enableData` app-side is necessary but **not sufficient**. The exact
inverse of the bug above also exists, and it fails on the SECOND registration
rather than the first:

```js
// dist/src/execution/utils.js — resolveSignersForChain
const enabled = await isSessionEnabled(...)
const enableData = enabled ? undefined : resolved.enableData   // discards it
```

Registration 1 enables the session, so registration 2 sees `enabled === true`,
the SDK drops the proof the app correctly supplied, and
`packStandaloneHcaFixedSessionSignature` picks the mode purely from
`signers.enableData`:

| `enableData` | gas refund | mode |
|---|---|---|
| truthy | — | `0x05` (carries proof) |
| falsy | yes | `0x02` |
| falsy | no | `0x01` |

A funded commit then signs `0x01`/`0x02`, the validator takes the non-first-use
path, and `permit` is rejected — `ActionNotAllowed(USDC, 0xd505accf)` masked as
`InvalidSignature()`. The app-side guard in `submitFundingAndCommitActor`
cannot catch it: by then the proof has already been handed to the SDK.

Note the trap in our own patch — teaching `isSessionEnabled` about the
standalone-HCA validator (passing `config.account.validator`) makes it *more*
accurate, which is what starts returning `true` and triggers the strip. The
patch therefore also pins the line above to keep the proof for standalone HCA:

```js
const enableData = enabled && !isStandaloneHca(config) ? undefined : resolved.enableData
```

Symptom to recognise: first registration succeeds, every later one fails, and
`isPermissionEnabled` is `true` at the failing block (not `false`, as in §7).
Read the mode byte before anything else — `0x01`/`0x02` on a batch that also
contains `enableSessionWithRefund` means the call and the signature disagree.

## 8. `UnclassifiedRevert` is NOT a policy failure — read the batch's own state

```
Simulation failed: UnclassifiedRevert
  errorSelector: 0x00000000  category: UNCLASSIFIED_REVERT  retryable: false
```

Everything above this section is about `InvalidSignature()` (`0x8baa579f`), which
is the validator rejecting the intent. `UnclassifiedRevert` with a **zero
selector** is the opposite: the validator passed, execution began, and one of
the batched calls reverted with data the orchestrator could not classify. A
plain `Error(string)` from an ERC-20 lands here — `0x08c379a0` is not in its
table — so do not go looking for a policy bug.

Decode `simulations[].signedIntentOp.…destinationOps` and check each call
against **live chain state for that user** before anything else. The ops decode
straightforwardly:

| `to` | selector | call |
|---|---|---|
| USDC | `0xd505accf` | `permit(owner, spender, value, deadline, v, r, s)` |
| USDC | `0x23b872dd` | `transferFrom(wallet, HCA, value)` |
| validator | `0x4a9b6c49` | `enableSessionWithRefund(...)` |
| registrar | `0xf14fcbc8` | `commit(bytes32)` |

```bash
cast call <usdc> 'balanceOf(address)(uint256)' <permit.owner> --rpc-url "$RPC"
cast call <usdc> 'nonces(address)(uint256)'    <permit.owner> --rpc-url "$RPC"
```

The first real instance: `permit`/`transferFrom` for `20196054` against a wallet
holding `20000000`. `transferFrom` reverts `ERC20: transfer amount exceeds
balance`, and since the batch is atomic the whole intent fails.

**Why it hits only some users.** The funding permit is signed for the whole HCA
budget — `registrationPrice + commitCost + registerCost` — while the pricing UI
gates on `registrationPrice` alone. On Sepolia the two legs have run to ~12 USDC
against an 8 USDC name, so any wallet holding between the price and the budget
clears checkout and then fails simulation. `signFundingPermitActor` now reads
`balanceOf(wallet)` and refuses before the wallet is ever prompted; if this
error resurfaces, check that gate first.

Note that `checkingHcaFunding` reads the **HCA's** balance, not the wallet's —
it decides whether a permit is needed at all, and never validated that the
wallet could honour one.
