#!/usr/bin/env bash
# Fund accounts for the STANDALONE-HCA registration flow on the local Anvil
# Sepolia fork.
#
# The standalone-HCA route is user-paid in Circle USDC (no gas sponsorship):
#   - the WALLET (EOA) signs an EIP-2612 permit letting the HCA pull USDC, so
#     the EOA must hold USDC;
#   - the mockestrator impersonates the HCA to fill intents, so the HCA needs
#     ETH for impersonated gas.
#
# Balances are set directly via `anvil_setStorageAt` (MockUSDC is a plain OZ
# ERC20: balances mapping at slot 0). Addresses come from
# `print-standalone-hca-addresses.mjs`, mirroring the app's manifest.
#
# Usage:
#   ./fund-rhinestone-account.sh [ADDRESS]
# If ADDRESS is omitted, funds a set of known test addresses.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"

# Standalone-HCA deployment addresses (MockUSDC etc.), from the app manifest.
eval "$(node "$SCRIPT_DIR/print-standalone-hca-addresses.mjs")"

# MockUSDC (OZ ERC20) storage layout: balances mapping base slot = 0.
USDC_BALANCE_SLOT=0
# 10,000 USDC (6 decimals) as a 32-byte hex value.
USDC_AMOUNT_HEX=$(cast to-uint256 10000000000)
# 10 ETH as a hex quantity (what `anvil_setBalance` expects).
ETH_AMOUNT_HEX=$(cast to-hex 10000000000000000000)

# Known addresses to fund. The standalone flow reads the EOA's USDC (permit
# source) and needs ETH in the standalone HCA (mockestrator impersonation gas).
# The standalone-HCA address is derived from owner + StandaloneHCAImplementation
# + userSalt(0), so it MOVES with every implementation redeploy. Recompute with:
#   cast call <StandaloneHCAFactory> 'deploy(address,address,uint256)(address)' <owner> <impl> 0
KNOWN_ADDRESSES=(
  "0x48B9c6898baFc8A3D3a495BF7c44CF3351486628"  # Standalone HCA for Anvil account 0 (0xf39F…2266)
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"  # Anvil account 0 (E2E headless wallet EOA — USDC permit source)
  "0xc9eec1b174a646d7c282820afe94acfba6c00a12"  # EOA for test1@test.getpara.com
)

set_usdc_balance() {
  local addr="$1"
  # slot = keccak256(abi.encode(addr, USDC_BALANCE_SLOT))
  local slot
  slot=$(cast index address "$addr" "$USDC_BALANCE_SLOT")
  cast rpc anvil_setStorageAt "$SH_USDC" "$slot" "$USDC_AMOUNT_HEX" \
    --rpc-url "$RPC_URL" >/dev/null
}

fund_address() {
  local addr="$1"
  echo "→ Funding $addr"

  # ETH for gas (impersonated HCA execution in the mockestrator).
  #
  # Set the balance directly instead of transferring from Anvil account 0. The
  # funder's balance is NOT guaranteed on a fork — it inherits real Sepolia
  # state and is drawn down by earlier setup — and once it dips below the
  # transfer value every remaining address fails with
  # "Insufficient funds for gas * price + value" (which `--quiet 2>/dev/null`
  # then hides, surfacing only as a bare exit 1). `anvil_setBalance` needs no
  # sender, spends no gas, and is idempotent.
  cast rpc anvil_setBalance "$addr" "$ETH_AMOUNT_HEX" \
    --rpc-url "$RPC_URL" >/dev/null
  echo "  ✅ 10 ETH set (gas)"

  # 10,000 Circle USDC via direct storage write (no open mint).
  set_usdc_balance "$addr"
  echo "  ✅ 10,000 USDC set (Circle USDC slot $USDC_BALANCE_SLOT)"
}

echo "=== Funding standalone-HCA accounts on fork at $RPC_URL ==="

if [[ $# -gt 0 ]]; then
  fund_address "$1"
else
  for addr in "${KNOWN_ADDRESSES[@]}"; do
    fund_address "$addr"
  done
fi

echo ""
echo "Done ✅"
