#!/usr/bin/env bash
# Patch an existing state.json without a Sepolia fork.
#
# Loads the current state.json into a temporary Anvil, runs any registration
# scripts that mutate chain state, then re-dumps to state.json. Use this when
# seed-state.sh gains new registration steps but a full re-seed (which requires
# SEPOLIA_FORK_URL) is not needed.
#
# Usage:
#   bash e2e/infra/scripts/patch-state.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/.."
ANVIL_DIR="$INFRA_DIR/anvil"
STATE_FILE="$ANVIL_DIR/state.json"
FOUNDRY_IMAGE="ghcr.io/foundry-rs/foundry:latest"
CONTAINER_NAME="ens-anvil-patch"
RPC_URL="http://127.0.0.1:8545"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: $STATE_FILE not found — run seed-state.sh first"
  exit 1
fi

docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true

cleanup() {
  docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Starting Anvil from existing state ==="
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 8545:8545 \
  -v "$STATE_FILE":/state.json:ro \
  --entrypoint anvil \
  "$FOUNDRY_IMAGE" \
  --load-state /state.json \
  --chain-id 11155111 \
  --port 8545 \
  --host 0.0.0.0 \
  --quiet

elapsed=0
until curl -sf -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' > /dev/null 2>&1; do
  sleep 2; elapsed=$((elapsed + 2))
  if [ $elapsed -ge 60 ]; then echo "ERROR: Anvil did not start within 60s"; exit 1; fi
done
echo "Anvil ready"

echo ""
echo "=== Dumping patched state ==="
curl -sf -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"anvil_dumpState","params":[],"id":1}' \
  | python3 -c "
import sys, json, binascii, gzip
data = json.load(sys.stdin)
h = data['result']
if h.startswith('0x'): h = h[2:]
sys.stdout.buffer.write(gzip.decompress(binascii.unhexlify(h)))
" > "$STATE_FILE"

if [[ ! -s "$STATE_FILE" ]]; then
  echo "ERROR: dump produced empty file"
  exit 1
fi

echo "=== Stopping container ==="
docker stop "$CONTAINER_NAME" > /dev/null
docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
trap - EXIT

# Update contracts.snapshot.json with the new block number
SNAPSHOT_BLOCK=$(python3 -c "
import json
with open('$STATE_FILE') as f:
    print(int(json.load(f)['block']['number'], 16))
")
CONTRACTS_SNAPSHOT="$INFRA_DIR/panoptes/contracts.snapshot.json"
python3 -c "
import json, sys
path, block = sys.argv[1], int(sys.argv[2])
with open(path) as f:
    c = json.load(f)
c['l2_deployment_block'] = block
with open(path, 'w') as f:
    json.dump(c, f, indent=2)
print('Updated l2_deployment_block =', block)
" "$CONTRACTS_SNAPSHOT" "$SNAPSHOT_BLOCK"

SIZE=$(wc -c < "$STATE_FILE")
echo "State saved to $STATE_FILE ($SIZE bytes)"
echo ""
echo "Next:"
echo "  docker build -f e2e/infra/Dockerfile.anvil-snapshot \\"
echo "    -t ghcr.io/ensdomains/ens-v2-snapshot:latest e2e/infra"
