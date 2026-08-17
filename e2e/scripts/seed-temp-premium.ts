/**
 * Seed a temporary-premium name on the local Anvil fork for MANUAL demos.
 *
 * Thin wrapper around `seed-name.ts` (the `premium` preset). Kept for the
 * existing `seed:premium` script and muscle memory. Registers the name to
 * `user2` (so your connected wallet is NOT the previous owner — the
 * StandardRentPriceOracle exempts the previous owner from the premium), then
 * warps anvil time so the name is expired by `DAYS` days, landing it in the
 * premium window.
 *
 * The premium decays exponentially (~$100M, halving each day), so the starting
 * additional fee is roughly `$100M / 2^DAYS`:
 *   DAYS=1   → ~$50M     DAYS=4  → ~$6.25M
 *   DAYS=13.3→ ~$10K     DAYS=18 → ~$380
 *
 * Prereqs:
 *   - Local stack up:   pnpm --filter @ens-apps/e2e infra:up
 *   - ANVIL_RPC_URL points at it (default http://127.0.0.1:8545)
 *
 * Usage:
 *   pnpm --filter @ens-apps/e2e seed:premium
 *   LABEL=tem DAYS=13.3 pnpm --filter @ens-apps/e2e seed:premium
 *
 * For other lifecycle states (active / expiring / grace / released) use
 * `seed-name.ts` (`pnpm --filter @ens-apps/e2e seed:name`).
 */
import { publicClient } from '../helpers/anvil-client.js'
import { seedName } from './seed-name.js'

const LABEL = process.env.LABEL ?? 'tem'
const DAYS = Number.parseFloat(process.env.DAYS ?? '13.3')
const SECONDS_PER_DAY = 24 * 60 * 60

async function main() {
  if (!Number.isFinite(DAYS) || DAYS <= 0) {
    throw new Error(`DAYS must be a positive number, got "${process.env.DAYS}"`)
  }

  const estPremium = 100_000_000 / 2 ** DAYS
  console.log(
    `Seeding "${LABEL}" expired ${DAYS} days ago → est. additional fee ≈ $${Math.round(
      estPremium,
    ).toLocaleString()}`,
  )

  const name = await seedName({
    label: LABEL,
    owner: 'user2',
    durationSeconds: -(DAYS * SECONDS_PER_DAY),
  })

  const block = await publicClient.getBlock()

  console.log('\n──────────────────────────────────────────────')
  console.log(`  Ready to buy:   ${name}`)
  console.log(`  Open the app:   /register/${name}`)
  console.log(
    `  Additional fee ≈ $${Math.round(estPremium).toLocaleString()} (decays from here)`,
  )
  console.log(
    `  Anvil block time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`,
  )
  console.log('  Sign in first — premium is hidden for a zero-address owner.')
  console.log(
    '  Tip: open with VITE_TIME_TRAVEL=1 and "Sync to chain" so the browser',
  )
  console.log('  clock matches anvil (premium chart / countdowns line up).')
  console.log('──────────────────────────────────────────────\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
