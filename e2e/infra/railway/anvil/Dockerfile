# Anvil (Sepolia fork) for Railway PR environments.
#
# The upstream foundry image's entrypoint is "/bin/sh -c", which mangles
# list-style commands (docker-compose overrides it too). Railway's custom
# start command hits the same quirk — the container exits 0 instead of
# running anvil. This wrapper pins a deterministic entrypoint instead.
#
# Binds [::]: a dual-stack socket accepts both IPv6 and IPv4, covering
# Railway private networking and the public proxy with one flag.
#
# SECURITY — this is an UNAUTHENTICATED, publicly-reachable dev chain:
#   * Anvil exposes cheatcodes (evm_increaseTime, evm_mine, anvil_setBalance,
#     state reset…) to anyone who finds the URL — they can sabotage a PR's
#     preview chain. Acceptable only because these are throwaway per-PR
#     environments (deleted on PR close + nightly sweep) holding testnet state
#     with no value.
#   * In FORK mode Anvil forwards state reads to $SEPOLIA_FORK_URL, so a public
#     endpoint is effectively an open proxy that burns that upstream RPC key's
#     quota. Mitigations, in order of preference:
#       1. Prefer the ens-v2-snapshot image (below) — it needs NO upstream RPC,
#          which removes the key-abuse vector entirely.
#       2. If fork mode is required, use a DEDICATED, rate-limited SEPOLIA_FORK_URL
#          key you can revoke — never the shared/production RPC key.
#       3. Consider not generating a public Railway domain for anvil unless a
#          browser actually needs direct RPC access.
#
# Once the ens-v2-snapshot image is rebuilt with current contracts, switch the
# service back to that image (see ../README.md) — snapshot needs no upstream
# RPC and boots in seconds.
#
# Railway service settings:
#   Root Directory:  e2e/infra
#   Dockerfile Path: railway/anvil/Dockerfile
#   Variables:       SEPOLIA_FORK_URL=<sepolia rpc url>
FROM ghcr.io/foundry-rs/foundry:latest

EXPOSE 8545

ENTRYPOINT ["/bin/sh", "-c", "exec anvil --fork-url \"$SEPOLIA_FORK_URL\" --chain-id 11155111 --port 8545 --host ::"]
