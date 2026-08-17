#!/usr/bin/env node
/**
 * Print the payment-token addresses the app actually reads, sourced from the
 * ensjs Sepolia chain config — the SAME source as
 * `@ens-apps/transaction-manager`'s SUPPORTED_TOKENS and the e2e fixtures
 * (see e2e/fixtures/makeV2Name.ts).
 *
 * The funding scripts (fund-account.sh, fund-rhinestone-account.sh) consume
 * this so they can never drift from the addresses the manager mints/registers
 * with. When ensjs bumps the token deployment, the funded tokens follow
 * automatically — no hardcoded addresses to update.
 *
 * Output (shell-eval friendly):
 *   MOCK_USDC=0x...
 *   MOCK_DAI=0x...
 *
 * Usage:
 *   eval "$(node e2e/infra/scripts/print-token-addresses.mjs)"
 */
import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'

const sepolia = ensL1Contracts[supportedL1Chains.sepolia]

const usdc = sepolia?.usdc?.address
const dai = sepolia?.dai?.address

if (!usdc || !dai) {
  console.error(
    'Failed to resolve USDC/DAI addresses from @ensdomains/ensjs/chain (sepolia)',
  )
  process.exit(1)
}

process.stdout.write(`MOCK_USDC=${usdc}\nMOCK_DAI=${dai}\n`)
