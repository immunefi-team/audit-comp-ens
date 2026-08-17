# HCA-batched MigrationHelper migration on Sepolia

## Release note

Following HCA registration support in #989, ENS v2 migration now uses the
remediated standalone HCA deployment and the HCA-aware MigrationHelper on
Sepolia. The connected wallet remains the name owner while each gas-safe HCA
batch calls MigrationHelper once, restores legacy manager access, and replays
records. Fresh HCA setup and required permissions are handled in-flow, with
execution paid in Sepolia ETH.

## Wallet confirmations

The preview displays an expected confirmation count and estimated network fee
for the selected names. Permission state is rechecked before the first wallet
prompt; if it changed, the flow asks the owner to review a refreshed preview
instead of silently adding or removing confirmations. Gas-safe batches are
re-estimated against live state during execution, so a large selection can use
fewer or more batches than the initial conservative estimate. On the successful
path, the common cases are:

| Selection | Existing HCA | Fresh HCA |
| --- | ---: | ---: |
| One unwrapped name | 2 | 3 |
| Wrapped names or multiple unwrapped names | 3 | 4 |
| Required permissions already exist | 1 | 2 |

The count includes the migration batch, required permission grants, automatic
operator-permission cleanup, and HCA deployment when needed. NFT approvals are
granted to MigrationHelper; the ETHRegistry manager-restoration approval is
granted to the HCA. One unwrapped name uses a per-token ERC-721 approval, which
clears automatically when the transfer succeeds. Multiple unwrapped names use
one temporary operator approval. A missing ETHRegistry approval adds a grant
and a cleanup confirmation. Every additional gas-safe atomic batch adds one
confirmation.

## Operator notes

- The deployment is pinned to `ensdomains/contracts-v2` PR #388 head
  `8d1c89350729f87b3968cf41ef3d683951444a44` through the shared typed manifest
  in `packages/smart-account`.
- The HCA-aware MigrationHelper from contracts-v2 PR #402 is pinned at
  `0xddC597d937618849348E18Db5D631Ce747bCDeEF`. Preflight requires its Sepolia
  runtime bytecode hash to equal
  `0x0b8acb00c2912a8b43085e0f55f9459b956cb51be1a16a5ff7ef0346dbd18143`.
- Migration uses a wallet-paid EOA transaction to
  `StandaloneHCA.executeByOwner(...)`; it does not use `wallet_sendCalls`, Warp,
  or a registration session. Each gas batch contains one
  `MigrationHelper.migrate(...)` call plus manager restoration and resolver
  replay calls.
- MigrationHelper resolves the certified HCA caller back to its EOA owner and
  checks that owner's ERC-721/ERC-1155 approvals to the helper. Unwrapped,
  unlocked, locked 2LD, and child inputs are grouped into one helper call while
  retaining parent-first execution order.
- Expected wrapper registries are derived recursively from VerifiableFactory.
  Locked hierarchies execute parent-first and fail closed when a required parent
  is missing, conflicting, uncertified, or cyclic.
- A name is reported complete only after its v2 owner, resolver, manager roles,
  resolver roles, and replayed records have been verified on-chain.
- Every atomic batch gets a durable intent marker before its wallet prompt, and
  its transaction hash replaces that marker before receipt polling. A
  confirmed-success batch that fails post-state verification is blocked from
  resubmission; a reverted batch is rebuilt only after source-token ownership
  is rechecked. A retry after an ambiguous pre-hash provider failure or an
  unavailable replacement receipt reconciles the latest post-state and proves
  source-token ownership before it can rebuild an incomplete batch.
- Custom resolvers are preserved. Locked names whose replaceable resolver is
  absent from the live `PublicResolverSet` remain blocked.
- Operator approvals created by the migration are temporary and are revoked
  automatically after the atomic batches verify. This includes NFT access for
  MigrationHelper and any manager-restoration access for the HCA. If cleanup is
  rejected or fails, the recovery action remains labelled
  `Revoke temporary HCA access`. Per-token approvals clear automatically when
  their transfers succeed.
- Text, address, contenthash, and ABI records are read from the V1 resolver,
  replayed in the HCA batch, and verified on-chain before completion.
- The rollout remains behind the existing migration feature flag.

## QA acceptance scenarios

QA should cover fresh and existing HCAs; unwrapped, unlocked wrapped, locked
2LD, and locked/detached descendant names; parent-first locked hierarchies;
legacy managers and records; multiple gas batches and retry reconciliation;
transaction speed-up/replacement; complete atomic rollback; automatic
token-approval clearing; operator-approval cleanup and cleanup retry. No
migration E2E implementation is included in this change.

## Release gate

Keep PR #1017 in draft and the feature flag disabled until contracts-v2 PRs
#386, #388, and #402 merge or Pavel confirms the corresponding deployments and
the helper route; the MigrationHelper source/deployment and pinned runtime hash
are confirmed; the live `PublicResolverSet` contains every replaceable
resolver; branch conflicts are resolved and CI is green; and QA signs off on
the preview. If any contract or QA gate misses the release window, do not fall
back silently to the direct-transfer route.
