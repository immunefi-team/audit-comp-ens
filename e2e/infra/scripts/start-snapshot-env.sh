#!/usr/bin/env bash
# Start the local E2E environment using the pre-seeded ENS V2 Snapshot image.
# No live Sepolia fork required — Anvil loads from a baked-in state snapshot.
#
# Usage:
#   ./start-snapshot-env.sh              # start snapshot stack
#   ./start-snapshot-env.sh <ADDRESS>    # start stack + fund an extra address
#   ./start-snapshot-env.sh --down       # tear down the stack
#
# After the stack is healthy the script prints the env vars you need.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"
BOX_COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.snapshot.yml"
export PANOPTES_CONTRACTS_FILE="./panoptes/contracts.snapshot.json"

# ---------- tear-down shortcut ----------
if [[ "${1:-}" == "--down" ]]; then
  echo "=== Stopping E2E snapshot stack ==="
  PANOPTES_CONTRACTS_FILE="$PANOPTES_CONTRACTS_FILE" \
    docker compose -f "$COMPOSE_FILE" -f "$BOX_COMPOSE_FILE" down
  echo "Done."
  exit 0
fi

# ---------- pull snapshot image (skip if already present locally) ----------
BOX_IMAGE="ghcr.io/ensdomains/ens-v2-snapshot:latest"
if docker image inspect "$BOX_IMAGE" > /dev/null 2>&1; then
  echo "=== ENS V2 Snapshot image found locally — skipping pull ==="
else
  echo "=== Pulling ENS V2 Snapshot image ==="
  if ! docker pull "$BOX_IMAGE"; then
    echo ""
    echo "ERROR: Could not pull $BOX_IMAGE and no local image found."
    echo "  Build locally with:"
    echo "    SEPOLIA_FORK_URL=https://... bash e2e/infra/scripts/seed-state.sh"
    echo "    docker build -f e2e/infra/Dockerfile.anvil-snapshot -t $BOX_IMAGE e2e/infra"
    exit 1
  fi
fi

# ---------- clean stale state ----------
# Wipe the panoptes-data volume so the indexer starts fresh against the
# snapshot snapshot. Stale data causes reorg-check failures on blocks that no
# longer exist in the loaded chain.
echo ""
echo "=== Cleaning stale Panoptes index (if any) ==="
PANOPTES_CONTRACTS_FILE="$PANOPTES_CONTRACTS_FILE" \
  docker compose -f "$COMPOSE_FILE" -f "$BOX_COMPOSE_FILE" down -v --remove-orphans \
  > /dev/null 2>&1 || true

# ---------- start ----------
echo ""
echo "=== Starting E2E snapshot stack (Anvil snapshot + Alto + Paymaster) ==="
PANOPTES_CONTRACTS_FILE="$PANOPTES_CONTRACTS_FILE" \
  docker compose -f "$COMPOSE_FILE" -f "$BOX_COMPOSE_FILE" up -d

# ---------- wait for health ----------
echo ""
echo "Waiting for services to become healthy..."

wait_for_service() {
  local service="$1"
  local max_wait="${2:-120}"
  local elapsed=0
  while [ $elapsed -lt "$max_wait" ]; do
    local health
    health=$(PANOPTES_CONTRACTS_FILE="$PANOPTES_CONTRACTS_FILE" \
      docker compose -f "$COMPOSE_FILE" -f "$BOX_COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
    if [[ "$health" == "healthy" ]]; then
      echo "  $service is healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "  ERROR: $service did not become healthy within ${max_wait}s"
  return 1
}

check_running() {
  local service="$1"
  local state
  state=$(PANOPTES_CONTRACTS_FILE="$PANOPTES_CONTRACTS_FILE" \
    docker compose -f "$COMPOSE_FILE" -f "$BOX_COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('State',''))" 2>/dev/null || echo "")
  if [[ "$state" == "running" ]]; then
    echo "  $service is running"
    return 0
  fi
  echo "  ERROR: $service is not running (state: ${state:-unknown})"
  return 1
}

# Snapshot Anvil starts in <5s (no fork init)
wait_for_service "anvil" 30

# ---------- fund accounts ----------
# Accounts are already funded in the baked state, but running the scripts
# again is idempotent and ensures any extra addresses get funded too.
echo ""
echo "=== Funding default Anvil account (portal headless wallet) ==="
bash "$SCRIPT_DIR/fund-account.sh" "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

FUND_ADDRESS="${1:-}"
if [[ -n "$FUND_ADDRESS" ]]; then
  echo ""
  echo "=== Funding account: $FUND_ADDRESS ==="
  bash "$SCRIPT_DIR/fund-account.sh" "$FUND_ADDRESS"
fi

echo ""
echo "=== Funding Rhinestone smart accounts ==="
bash "$SCRIPT_DIR/fund-rhinestone-account.sh"

# ---------- wait for remaining services ----------
wait_for_service "alto" 90
check_running "paymaster"
wait_for_service "mockestrator" 60

# ---------- print env ----------
echo ""
echo "=== Environment variables for the app ==="
echo ""
echo "  # Pimlico/ZeroDev path (default)"
echo "  VITE_SEPOLIA_RPC_URL=http://127.0.0.1:8545"
echo "  VITE_PIMLICO_BUNDLER_URL=/bundler   (Vite proxy → 127.0.0.1:4337)"
echo ""
echo "  # Rhinestone path (add these to use Rhinestone instead of Pimlico)"
echo "  VITE_RHINESTONE_ENDPOINT_URL=/orchestrator   (Vite proxy → 127.0.0.1:3007)"
echo '  VITE_RHINESTONE_CUSTOM_RPC_URLS={"11155111":"http://127.0.0.1:8545"}'
echo ""
echo "Copy these into your app's .env and (re)start the dev server so Vite picks them up."
echo ""
echo "To stop the stack later:"
echo "  $0 --down"
