/**
 * Seed a .eth name on the local Anvil fork in a chosen lifecycle state, for
 * MANUAL testing. Reuses the SAME `createMakeName` flow as the e2e tests, but
 * runs standalone (no Playwright).
 *
 * Prereqs:
 *   - Local stack up:   pnpm --filter @ens-apps/e2e infra:up
 *   - ANVIL_RPC_URL points at it (default http://127.0.0.1:8545)
 *
 * Usage:
 *   # State presets (sensible day offsets for each lifecycle stage):
 *   STATE=grace    pnpm --filter @ens-apps/e2e seed:name
 *   STATE=premium  LABEL=demo pnpm --filter @ens-apps/e2e seed:name
 *   STATE=released pnpm --filter @ens-apps/e2e seed:name
 *
 *   # Explicit control (overrides the preset's day offset):
 *   EXPIRES_IN_DAYS=120 pnpm --filter @ens-apps/e2e seed:name      # active
 *   EXPIRED_AGO_DAYS=5  pnpm --filter @ens-apps/e2e seed:name      # 5 days past expiry
 *   OWNER=user STATE=grace pnpm --filter @ens-apps/e2e seed:name   # connected wallet owns it
 *   RECORDS='com.twitter=ensdomains;url=https://ens.domains' STATE=active pnpm ... seed:name
 *
 * States (boundaries reflect the app's V2 grace = 28d + premium = 21d windows;
 * exact on-chain availability/premium depends on the fork's oracle config):
 *   active    → expires in ~1y                       (owned by `user`)
 *   expiring  → expires in 28d (soonest allowed)      (owned by `user`)
 *   grace     → expired 3d ago, inside grace          (owned by `user`)
 *   premium   → expired 13.3d ago, temporary premium  (owned by `user2`)
 *   released  → expired 60d ago, fully available      (owned by `user2`)
 *
 * NOTE: seeding a *past-expiry* state advances the shared Anvil clock forward
 * (the name is registered then time is warped past its expiry). Seeding several
 * past-expiry names in a row keeps pushing the clock, which can move earlier
 * names further along their lifecycle. For a live walk-through, prefer seeding
 * an `active` name and advancing time with the in-app Time Travel panel.
 */

import { pathToFileURL } from 'node:url'
import { type Address, bytesToHex, type Hash } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { createMakeName } from '../fixtures/makeName.js'
import type { Time } from '../fixtures/time.js'
import { publicClient } from '../helpers/anvil-client.js'

const SECONDS_PER_DAY = 24 * 60 * 60
const DEFAULT_MNEMONIC =
  'test test test test test test test test test test test junk'

export type SeedState = 'active' | 'expiring' | 'grace' | 'premium' | 'released'

/** Signed day offset (positive = expires in N days; negative = expired N days ago). */
type StatePreset = { days: number; owner: 'user' | 'user2'; label: string }

export const STATE_PRESETS: Record<SeedState, StatePreset> = {
  active: { days: 365, owner: 'user', label: 'active' },
  expiring: { days: 28, owner: 'user', label: 'expiring' },
  grace: { days: -3, owner: 'user', label: 'grace' },
  premium: { days: -13.3, owner: 'user2', label: 'premium' },
  released: { days: -60, owner: 'user2', label: 'released' },
}

/**
 * Anvil accounts from the standard test mnemonic — mirrors the manager
 * fixture's `createAnvilAccounts`.
 */
export function createAnvilAccounts() {
  const users = ['user', 'user2', 'user3', 'user4'] as const
  const addresses: Address[] = []
  const privateKeys: Hash[] = []
  users.forEach((_, index) => {
    const { getHdKey } = mnemonicToAccount(DEFAULT_MNEMONIC, {
      addressIndex: index,
    })
    // biome-ignore lint/style/noNonNullAssertion: hd key always has a private key
    const pk = bytesToHex(getHdKey().privateKey!) as Hash
    addresses.push(privateKeyToAccount(pk).address)
    privateKeys.push(pk)
  })
  return {
    getAddress: (user = 'user'): Address => {
      const i = users.indexOf(user as (typeof users)[number])
      if (i < 0) throw new Error(`User not found: ${user}`)
      return addresses[i]
    },
    getPrivateKey: (user = 'user'): Hash => {
      const i = users.indexOf(user as (typeof users)[number])
      if (i < 0) throw new Error(`User not found: ${user}`)
      return privateKeys[i]
    },
  }
}

/**
 * No-op `Time` stub. `createMakeName` only uses `time.sync()` to align the
 * Playwright browser clock — irrelevant for a headless seed. (The app reads
 * the authoritative state straight from the chain when you open it.)
 */
export const noopTime: Time = {
  sync: async () => {},
  increaseTime: async () => {},
  syncFixed: async () => {},
  resume: async () => {},
  logBlockTime: async () => {},
}

export type SeedNameOptions = {
  label: string
  owner: string
  /** Signed seconds: positive = expires in N; negative = expired N ago. */
  durationSeconds: number
  records?: { key: string; value: string }[]
}

/** Register a name on the fork in the requested state; returns the full name. */
export async function seedName(options: SeedNameOptions): Promise<string> {
  const makeName = createMakeName({
    accounts: createAnvilAccounts(),
    time: noopTime,
  })
  return makeName(
    {
      label: options.label,
      duration: options.durationSeconds,
      owner: options.owner,
      records: options.records,
    },
    { timeOffset: 0 },
  )
}

function parseRecords(
  raw: string | undefined,
): { key: string; value: string }[] | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('[')) return JSON.parse(trimmed)
  return trimmed.split(';').map((pair) => {
    const idx = pair.indexOf('=')
    if (idx < 0) {
      throw new Error(`Invalid RECORDS entry "${pair}" (expected key=value)`)
    }
    return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() }
  })
}

async function main() {
  const stateArg = (process.env.STATE ?? 'premium').toLowerCase() as SeedState
  const preset = STATE_PRESETS[stateArg]
  if (!preset) {
    throw new Error(
      `Unknown STATE "${stateArg}". Use one of: ${Object.keys(STATE_PRESETS).join(', ')}`,
    )
  }

  let days = preset.days
  if (process.env.EXPIRED_AGO_DAYS != null) {
    days = -Math.abs(Number.parseFloat(process.env.EXPIRED_AGO_DAYS))
  } else if (process.env.EXPIRES_IN_DAYS != null) {
    days = Math.abs(Number.parseFloat(process.env.EXPIRES_IN_DAYS))
  }
  if (!Number.isFinite(days) || days === 0) {
    throw new Error(`Invalid day offset: ${days}`)
  }

  const owner = process.env.OWNER ?? preset.owner
  const label = process.env.LABEL ?? preset.label
  const records = parseRecords(process.env.RECORDS)
  const durationSeconds = Math.round(days * SECONDS_PER_DAY)

  const expiredAgo = days < 0
  console.log(
    `Seeding "${label}" [state=${stateArg}, owner=${owner}] — ${
      expiredAgo
        ? `expired ${Math.abs(days)} day(s) ago`
        : `expires in ${days} day(s)`
    }`,
  )
  if (stateArg === 'premium' && expiredAgo && Math.abs(days) <= 21) {
    const estPremium = 100_000_000 / 2 ** Math.abs(days)
    console.log(
      `  est. additional fee ≈ $${Math.round(estPremium).toLocaleString()} (decays from here)`,
    )
  }

  const name = await seedName({ label, owner, durationSeconds, records })
  const block = await publicClient.getBlock()

  console.log('\n──────────────────────────────────────────────')
  console.log(`  Name:            ${name}`)
  console.log(`  Buyer view:      /register/${name}`)
  console.log(`  Profile view:    /${name}`)
  console.log(
    `  Anvil block time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`,
  )
  console.log(
    '  Open the app with VITE_TIME_TRAVEL=1, then "Sync to chain" so the',
  )
  console.log('  browser clock matches the (warped) Anvil time.')
  if (owner === 'user2') {
    console.log(
      '  Sign in as `user` — premium is hidden for a zero-address owner.',
    )
  }
  console.log('──────────────────────────────────────────────\n')
}

// Run the CLI only when executed directly (not when imported, e.g. by
// seed-temp-premium.ts), so importing `seedName` has no side effects.
const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
