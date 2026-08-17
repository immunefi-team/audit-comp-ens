/**
 * Seed a **managed-only** V2 name for MANUAL testing of the address-profile
 * "Managed" filter (PR #964).
 *
 * A managed-only name is one the connected wallet does NOT own but has a
 * non-zero role bitmap on — it surfaces via the indexer's `roles(account:)`
 * query (getDashboardRoleAssignments) and is classified `managed` by
 * getManagedOnlyRoleNames. There is no way to produce this from the in-app
 * Dev Tools drawer (no second wallet), so this script does it headlessly:
 *
 *   1. Register a fresh .eth name owned by a SEPARATE account (mnemonic #1),
 *      NOT the connected wallet — reusing the same makeV2Name flow as the
 *      e2e suite.
 *   2. From that owner, grant a per-name role (ROLE_SET_RESOLVER + ROLE_RENEW)
 *      to the connected wallet (mnemonic #0 = 0xf39…2266 by default).
 *   3. Poll the local indexer until the grant is indexed as a role assignment
 *      for the connected wallet.
 *
 * After this, opening the connected wallet's address profile and switching to
 * the "Managed" chip should show the name.
 *
 * Prereqs:
 *   - Local stack up:  pnpm --filter @ens-apps/e2e infra:up
 *   - ANVIL_RPC_URL points at it (default http://127.0.0.1:8545)
 *
 * Usage:
 *   pnpm --filter @ens-apps/e2e seed:managed-name
 *   LABEL=mymanaged pnpm --filter @ens-apps/e2e seed:managed-name
 *   MANAGER_ADDRESS=0x… pnpm --filter @ens-apps/e2e seed:managed-name   # override the "connected" wallet
 *   ROLES='ROLE_RENEW' pnpm --filter @ens-apps/e2e seed:managed-name    # semicolon/comma list of ensjs role names
 */
import { pathToFileURL } from 'node:url'
import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import { labelToCanonicalId, type Role } from '@ensdomains/ensjs/utils/v2'
import { grantRolesWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import { type Address, encodeFunctionData } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { createMakeV2Name } from '../fixtures/makeV2Name.js'
import { publicClient, walletClient } from '../helpers/anvil-client.js'

const DEFAULT_MNEMONIC =
  'test test test test test test test test test test test junk'

/**
 * The registry that holds `.eth` 2LD tokens on this fork — the same
 * `ensRegistry` address makeV2Name reads expiry from, and where the name's
 * owner holds the per-name admin roles required to grant. (This IS the .eth
 * PermissionedRegistry in the v2 contract set; the name is NOT in the
 * standalone ETH registry 0x796fff2e — the owner holds no roles there.)
 */
const ETH_REGISTRY = (process.env.REGISTRY_ADDRESS ??
  ensL1Contracts[supportedL1Chains.sepolia].ensRegistry.address) as Address

const INDEXER_URL =
  process.env.INDEXER_GRAPHQL_URL ?? 'http://127.0.0.1:5655/graphql'

/**
 * ensjs role names granted to the manager. Must be roles the NAME OWNER holds
 * the *_ADMIN for — at registration the owner receives admin over
 * ROLE_SET_RESOLVER and ROLE_SET_SUBREGISTRY (but NOT ROLE_RENEW), so granting
 * ROLE_RENEW reverts with EACCannotGrantRoles. getManagedOnlyRoleNames only
 * needs a non-zero bitmap, so these suffice to classify the name as managed.
 */
const DEFAULT_ROLES: Role[] = ['ROLE_SET_RESOLVER', 'ROLE_SET_SUBREGISTRY']

function parseRoles(raw: string | undefined): Role[] {
  const trimmed = raw?.trim()
  if (!trimmed) return DEFAULT_ROLES
  return trimmed
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter(Boolean) as Role[]
}

/** Poll the indexer's `roles(account:)` until the granted name shows up. */
async function waitForIndexedRole(
  account: Address,
  name: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const query = `{ roles(account: "${account.toLowerCase()}") { name roleBitmap } }`
  while (Date.now() < deadline) {
    try {
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = (await res.json()) as {
        data?: { roles?: { name: string | null; roleBitmap: string }[] }
      }
      const hit = json.data?.roles?.some(
        (r) =>
          r.name?.toLowerCase() === name.toLowerCase() && r.roleBitmap !== '0',
      )
      if (hit) return true
    } catch {
      /* indexer not ready yet */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function main() {
  const label = process.env.LABEL ?? 'managed'
  const roles = parseRoles(process.env.ROLES)

  // Connected manager wallet (mnemonic #0 = 0xf39…2266) — the grantee.
  const managerAddress = (process.env.MANAGER_ADDRESS ??
    mnemonicToAccount(DEFAULT_MNEMONIC, { addressIndex: 0 }).address) as Address

  // Separate owner account (mnemonic #1) — owns the name, grants the role.
  const ownerAccount = mnemonicToAccount(DEFAULT_MNEMONIC, { addressIndex: 1 })

  if (ownerAccount.address.toLowerCase() === managerAddress.toLowerCase()) {
    throw new Error(
      'Owner and manager resolved to the same address — a managed-only name ' +
        'requires distinct accounts. Override MANAGER_ADDRESS.',
    )
  }

  console.log(
    `Seeding managed-only name "${label}" — owner=${ownerAccount.address}, ` +
      `manager(grantee)=${managerAddress}, roles=[${roles.join(', ')}]`,
  )

  // ── 1. Register the name to the owner (NOT the connected wallet) ─────
  const makeV2Name = createMakeV2Name({ otherAccount: ownerAccount })
  const name = await makeV2Name({ label, owner: 'other' })
  const nameLabel = name.replace(/\.eth$/, '')

  // ── 2. Grant a per-name role to the connected wallet ─────────────────
  const resource = labelToCanonicalId(nameLabel)
  const writeParams = grantRolesWriteParameters(
    // The clients used here only need chain/account for the type assertion.
    { chain: walletClient.chain, account: ownerAccount } as Parameters<
      typeof grantRolesWriteParameters
    >[0],
    {
      registryAddress: ETH_REGISTRY,
      account: managerAddress,
      resource,
      roles,
    },
  )
  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  const grantTx = await walletClient.sendTransaction({
    account: ownerAccount,
    chain: walletClient.chain,
    to: ETH_REGISTRY,
    data,
  })
  await publicClient.waitForTransactionReceipt({ hash: grantTx })
  console.log(
    `[grant] ✅ granted [${roles.join(', ')}] on ${name} to ${managerAddress}`,
  )

  // ── 3. Wait for the indexer to pick it up ────────────────────────────
  console.log('[indexer] waiting for the role assignment to be indexed…')
  const indexed = await waitForIndexedRole(managerAddress, name)

  const block = await publicClient.getBlock()
  console.log('\n──────────────────────────────────────────────')
  console.log(`  Managed name:    ${name}`)
  console.log(`  Owner:           ${ownerAccount.address}`)
  console.log(`  Manager (you):   ${managerAddress}`)
  console.log(`  Roles granted:   ${roles.join(', ')}`)
  console.log(
    `  Indexed:         ${indexed ? 'yes' : 'NOT YET (check indexer)'}`,
  )
  console.log(`  Profile view:    /${managerAddress}  → "Managed" chip`)
  console.log(
    `  Anvil block time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`,
  )
  console.log('──────────────────────────────────────────────\n')
  if (!indexed) {
    console.warn(
      'Role not indexed within the timeout — the grant landed on-chain, but ' +
        'the indexer may be lagging. Re-check the "Managed" chip shortly.',
    )
  }
}

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
