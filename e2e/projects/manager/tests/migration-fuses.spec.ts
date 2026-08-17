/**
 * ENS V1→V2 Migration — Fuse Combinations
 *
 * Tests that locked names with various owner-controlled fuse bitmaps migrate
 * successfully and produce valid V2 state (REGISTERED + WrapperRegistry).
 *
 * Each test:
 * 1. Registers a locked V1 name on the Anvil fork with the given fuse combo.
 * 2. Mocks the V1 subgraph with the correct full NameWrapper fuse bitmap
 *    (owner fuses | PARENT_CANNOT_CONTROL | IS_DOT_ETH = owner fuses | 0x30000).
 *    The mock helper ORs these in automatically when `fuses` is provided.
 * 3. Runs the migration UI flow.
 * 4. Asserts the name is REGISTERED and has a WrapperRegistry subregistry.
 *
 * Prerequisites:
 *   - Anvil fork running with V1 + V2 contracts
 *   - Manager app running on MANAGER_APP_URL (default localhost:3000)
 */
import { privateKeyToAccount } from 'viem/accounts'
import {
  createMakeV1Name,
  FUSES,
  V1_PUBLIC_RESOLVER,
} from '../../../fixtures/makeV1Name.js'
import {
  authorizeTransaction,
  expect,
  test,
} from '../../../fixtures/playwright.manager.fixture.js'
import {
  assertLockedMigration,
  assertV2Resolver,
} from '../../../helpers/migration-assertions.js'
import { mockV1Subgraph } from '../../../helpers/mock-v1-subgraph.js'

const MANAGER_APP_URL = process.env.MANAGER_APP_URL ?? 'http://localhost:3000'

const HEADLESS_USER_ADDRESS = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
).address

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runMigrationFlow(
  page: import('@playwright/test').Page,
  wallet: import('@ensdomains/headless-web3-provider').Web3ProviderBackend,
) {
  await page.goto(`${MANAGER_APP_URL}/dashboard`)
  await page.waitForLoadState('networkidle')

  const upgradeButton = page
    .getByRole('button', { name: 'Upgrade Names' })
    .first()
  await upgradeButton.waitFor({ state: 'visible', timeout: 10_000 })
  await upgradeButton.click()

  await page.waitForTimeout(2_000)

  const confirmButton = page.getByRole('button', { name: 'Upgrade Names' })
  await confirmButton.waitFor({ state: 'visible', timeout: 10_000 })
  await Promise.all([
    confirmButton.click(),
    authorizeTransaction(wallet, 90_000),
  ])

  const successIndicator = page.getByText("You're on ENS v2!")
  await successIndicator.waitFor({ state: 'visible', timeout: 60_000 })

  const doneButton = page.getByRole('button', { name: 'Done' })
  await doneButton.waitFor({ state: 'visible', timeout: 10_000 })
  await doneButton.click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('ENS V1→V2 Migration — Fuse Combinations', () => {
  test.describe.configure({ timeout: 300_000 })

  test('locked + CANNOT_BURN_FUSES migrates and produces locked V2 state', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const v1Name = await makeV1Name({
      label: 'fuse-cbf',
      type: 'locked',
      fuses: FUSES.CANNOT_BURN_FUSES,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+CANNOT_BURN_FUSES name created: ${v1Name}`,
    )

    // fuses param passed to mockV1Subgraph is the owner-controlled bits only;
    // the mock ORs in PARENT_CANNOT_CONTROL | IS_DOT_ETH (0x30000) automatically.
    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_BURN_FUSES,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)
    console.log(
      `[migration-fuses] ✅ locked+CANNOT_BURN_FUSES migration verified for ${v1Name}`,
    )
  })

  test('locked + CANNOT_TRANSFER migrates and produces locked V2 state', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const v1Name = await makeV1Name({
      label: 'fuse-ct',
      type: 'locked',
      fuses: FUSES.CANNOT_TRANSFER,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+CANNOT_TRANSFER name created: ${v1Name}`,
    )

    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_TRANSFER,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)
    console.log(
      `[migration-fuses] ✅ locked+CANNOT_TRANSFER migration verified for ${v1Name}`,
    )
  })

  test('locked + CANNOT_SET_RESOLVER migrates and preserves V1 resolver', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const v1Name = await makeV1Name({
      label: 'fuse-csr',
      type: 'locked',
      fuses: FUSES.CANNOT_SET_RESOLVER,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+CANNOT_SET_RESOLVER name created: ${v1Name}`,
    )

    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_SET_RESOLVER,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)

    // CANNOT_SET_RESOLVER means the V1 resolver cannot be changed by the owner.
    // After migration the V2 registry resolver slot should point to the V1 public
    // resolver so that existing records remain resolvable without a re-write.
    await assertV2Resolver(label, V1_PUBLIC_RESOLVER)
    console.log(
      `[migration-fuses] ✅ locked+CANNOT_SET_RESOLVER migration + resolver verified for ${v1Name}`,
    )
  })

  test('locked + CANNOT_CREATE_SUBDOMAIN migrates and produces locked V2 state', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const v1Name = await makeV1Name({
      label: 'fuse-ccs',
      type: 'locked',
      fuses: FUSES.CANNOT_CREATE_SUBDOMAIN,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+CANNOT_CREATE_SUBDOMAIN name created: ${v1Name}`,
    )

    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_CREATE_SUBDOMAIN,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)
    console.log(
      `[migration-fuses] ✅ locked+CANNOT_CREATE_SUBDOMAIN migration verified for ${v1Name}`,
    )
  })

  test('locked + CAN_EXTEND_EXPIRY migrates and produces locked V2 state', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const v1Name = await makeV1Name({
      label: 'fuse-cee',
      type: 'locked',
      fuses: FUSES.CAN_EXTEND_EXPIRY,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+CAN_EXTEND_EXPIRY name created: ${v1Name}`,
    )

    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CAN_EXTEND_EXPIRY,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)
    console.log(
      `[migration-fuses] ✅ locked+CAN_EXTEND_EXPIRY migration verified for ${v1Name}`,
    )
  })

  test('locked + all child fuses migrates and produces locked V2 state', async ({
    migrationConnectedPage: page,
    wallet,
    accounts,
  }) => {
    const makeV1Name = createMakeV1Name({
      userAccount: privateKeyToAccount(accounts.getPrivateKey('user')),
    })
    const allChildFuses =
      FUSES.CANNOT_BURN_FUSES |
      FUSES.CANNOT_TRANSFER |
      FUSES.CANNOT_SET_RESOLVER |
      FUSES.CANNOT_CREATE_SUBDOMAIN |
      FUSES.CANNOT_APPROVE |
      FUSES.CAN_EXTEND_EXPIRY

    const v1Name = await makeV1Name({
      label: 'fuse-all',
      type: 'locked',
      fuses: allChildFuses,
    })
    const label = v1Name.replace('.eth', '')
    console.log(
      `[migration-fuses] locked+all-child-fuses name created: ${v1Name}`,
    )

    await mockV1Subgraph(page, [
      {
        name: v1Name,
        ownerAddress: HEADLESS_USER_ADDRESS,
        type: 'locked',
        // Pass owner-controlled fuses; mock ORs in PARENT_CANNOT_CONTROL | IS_DOT_ETH
        fuses: FUSES.CANNOT_UNWRAP | allChildFuses,
      },
    ])

    await runMigrationFlow(page, wallet)
    await assertLockedMigration(label)
    console.log(
      `[migration-fuses] ✅ locked+all-child-fuses migration verified for ${v1Name}`,
    )
  })
})
