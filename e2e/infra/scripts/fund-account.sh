#!/usr/bin/env bash
# Fund a test account on the local Anvil Sepolia fork.
#
# Usage:
#   ./fund-account.sh <ADDRESS>
#   ./fund-account.sh 0x89b22e5D4f18186F459dF61cea9A489Cedb1028d
#
# What it does:
#   1. Sends 1 ETH to the address (for gas)
#   2. Mints 10 000 MockUSDC (6 decimals)
#   3. Mints 10 000 MockDAI  (18 decimals)
#
# Prerequisites:
#   - Foundry (`cast`) installed
#   - Anvil fork running on RPC_URL (default http://127.0.0.1:8545)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADDRESS="${1:?Usage: fund-account.sh <ADDRESS>}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"

# Anvil's first default account — used as the sender for the `mint` calls below.
# NOTE: on a fork this account does NOT reliably hold 10,000 ETH; it inherits
# real Sepolia state and is drawn down by the other funding scripts. Its balance
# is topped up explicitly below rather than assumed.
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ANVIL_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
# 10 ETH / 10,000 ETH as hex quantities (what `anvil_setBalance` expects).
ETH_AMOUNT_HEX=$(cast to-hex 10000000000000000000)
FUNDER_AMOUNT_HEX=$(cast to-hex 10000000000000000000000)

# Payment-token addresses, resolved from the ensjs Sepolia chain config — the
# SAME source the app uses (`@ens-apps/transaction-manager` SUPPORTED_TOKENS).
# Resolving them dynamically prevents drift: hardcoding meant a token-address
# bump in ensjs left this script minting stale tokens, so the funded account
# had zero balance of the tokens the manager actually reads → the stablecoin
# payment option stayed disabled and registration E2E timed out picking USDC.
eval "$(node "$SCRIPT_DIR/print-token-addresses.mjs")"

echo "=== Funding $ADDRESS on fork at $RPC_URL ==="
echo "    tokens: USDC=$MOCK_USDC DAI=$MOCK_DAI"

# 0. Clear any contract code at the address.
#    The well-known Anvil account 0xf39F…2266 has an EOF contract deployed
#    on Sepolia, which breaks ERC1155 _safeMint (ERC1155InvalidReceiver).
#    Setting the code to 0x makes it an EOA again on the fork.
echo "→ Clearing contract code at $ADDRESS (make it an EOA)..."
cast rpc anvil_setCode "$ADDRESS" "0x" --rpc-url "$RPC_URL" > /dev/null
echo "  ✅ Code cleared"

# 1. Set ETH balance directly — no sender, no gas, idempotent. Transferring from
#    Anvil account 0 fails once that account runs dry ("Insufficient funds for
#    gas * price + value"), which is exactly what happens on a fork where it
#    inherits real Sepolia state and the sibling funding scripts spend it.
echo "→ Setting 10 ETH balance..."
cast rpc anvil_setBalance "$ADDRESS" "$ETH_AMOUNT_HEX" --rpc-url "$RPC_URL" >/dev/null
echo "  ✅ 10 ETH set"

# 1b. Top up the funder itself: the `mint` calls below are real transactions and
#     still need gas. Done AFTER the step above so that funding account 0 (the
#     common case) leaves it with the full funder balance, not 10 ETH.
echo "→ Topping up funder $ANVIL_ADDRESS..."
cast rpc anvil_setBalance "$ANVIL_ADDRESS" "$FUNDER_AMOUNT_HEX" --rpc-url "$RPC_URL" >/dev/null
echo "  ✅ funder topped up"

# 2. Mint MockUSDC (6 decimals → 10_000 * 1e6 = 10000000000)
echo "→ Minting 10 000 MockUSDC..."
cast send "$MOCK_USDC" "mint(address,uint256)" "$ADDRESS" 10000000000 \
  --private-key "$ANVIL_KEY" \
  --rpc-url "$RPC_URL" \
  --quiet
echo "  ✅ 10 000 USDC minted"

# 3. Mint MockDAI (18 decimals → 10_000 * 1e18 = 10000000000000000000000)
echo "→ Minting 10 000 MockDAI..."
cast send "$MOCK_DAI" "mint(address,uint256)" "$ADDRESS" 10000000000000000000000 \
  --private-key "$ANVIL_KEY" \
  --rpc-url "$RPC_URL" \
  --quiet
echo "  ✅ 10 000 DAI minted"

# Print balances
echo ""
echo "=== Balances ==="
ETH_BAL=$(cast balance "$ADDRESS" --rpc-url "$RPC_URL" --ether)
USDC_BAL=$(cast call "$MOCK_USDC" "balanceOf(address)(uint256)" "$ADDRESS" --rpc-url "$RPC_URL")
DAI_BAL=$(cast call "$MOCK_DAI" "balanceOf(address)(uint256)" "$ADDRESS" --rpc-url "$RPC_URL")
echo "  ETH:  $ETH_BAL"
echo "  USDC: $USDC_BAL (raw, 6 decimals)"
echo "  DAI:  $DAI_BAL (raw, 18 decimals)"
echo ""
echo "Done ✅"
