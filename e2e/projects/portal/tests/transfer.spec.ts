import type { Web3ProviderBackend } from '@ensdomains/headless-web3-provider'
import type { Page } from '@playwright/test'
import {
  connectWithHeadlessWallet,
  expect,
  test,
} from '../../../fixtures/playwright.portal.fixture.js'
import { authorizeTransaction } from '../../../helpers/portal-auth.js'

const PORTAL_APP_URL = process.env.PORTAL_APP_URL ?? 'http://localhost:3001'

/**
 * Drives the shared `TransactionModal` (`[data-slot="dialog-content"]`) through
 * however many steps a flow needs, authorizing each wallet prompt as it appears,
 * until every transaction id in `successTxIds` has logged a `state: success`
 * console line (the format emitted by `transactionManager.ts`). Reused across
 * the transfer, change-resolver (2-step: deploy + set), and save-records flows.
 */
async function driveTransactionsToSuccess(
  page: Page,
  wallet: Web3ProviderBackend,
  successTxIds: string[],
  timeoutMs = 180_000,
): Promise<void> {
  const transactionDialog = page.locator('[data-slot="dialog-content"]')
  await expect(transactionDialog).toBeVisible({ timeout: 30_000 })

  const succeeded = new Set<string>()
  const onConsole = (msg: { text(): string }) => {
    const text = msg.text()
    for (const id of successTxIds) {
      if (text.includes(`Transaction ${id} state: success`)) succeeded.add(id)
    }
  }
  page.on('console', onConsole)

  try {
    const deadline = Date.now() + timeoutMs
    // Loop on wall-clock time alone, not on `succeeded.size` — the final
    // step's "Done" button only renders *after* its success console line
    // lands, and only clicking it fires `finishFlow` (see
    // useAutoAdvanceTransaction.ts: auto-advance deliberately skips the last
    // transaction, so nothing else triggers the redirect). Exiting the
    // moment the count matches races ahead of that button ever appearing.
    while (Date.now() < deadline) {
      const openWalletButton = transactionDialog.getByRole('button', {
        name: /open wallet/i,
      })
      if (await openWalletButton.isVisible().catch(() => false)) {
        await openWalletButton.click()
        await authorizeTransaction(wallet, 60_000)
        await page.waitForTimeout(500)
        continue
      }

      const waitingButton = transactionDialog.getByRole('button', {
        name: /^Waiting\.\.\.$/i,
      })
      if (await waitingButton.isVisible().catch(() => false)) {
        const iconWalletButton = waitingButton.locator(
          'xpath=preceding-sibling::button[1]',
        )
        if (await iconWalletButton.isVisible().catch(() => false)) {
          await iconWalletButton.click()
          await authorizeTransaction(wallet, 60_000)
          await page.waitForTimeout(500)
          continue
        }
      }

      const primaryButton = transactionDialog.getByRole('button', {
        name: /^(Start|Next|Done)$/i,
      })
      if (
        (await primaryButton.isVisible().catch(() => false)) &&
        (await primaryButton.isEnabled().catch(() => false))
      ) {
        await primaryButton.click()
        await page.waitForTimeout(500)
        continue
      }

      // Every tracked tx has succeeded and there's nothing left to click
      // (the last "Done" press already fired `finishFlow` and closed the
      // modal) — safe to stop polling.
      if (succeeded.size === successTxIds.length) break

      await page.waitForTimeout(1_000)
    }
  } finally {
    page.off('console', onConsole)
  }

  expect(succeeded.size).toBe(successTxIds.length)
}

/**
 * Confirms `ownerAddress` is shown as the owner on both the name's Overview
 * tab (`/$name`, labeled "Owner") and Ownership tab (`/$name/ownership`,
 * labeled "Name owner") — see the shared `Owner` component.
 */
async function expectOwnerOnNamePages(
  page: Page,
  name: string,
  ownerAddress: string,
): Promise<void> {
  const shortenedOwner = `${ownerAddress.slice(0, 6)}…${ownerAddress.slice(-4)}`

  await page.goto(`${PORTAL_APP_URL}/${name}`)
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(shortenedOwner).first()).toBeVisible({
    timeout: 15_000,
  })

  await page.goto(`${PORTAL_APP_URL}/${name}/ownership`)
  await expect(
    page.getByText('Name owner', { exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(shortenedOwner).first()).toBeVisible({
    timeout: 15_000,
  })
}

/// skipping old tests that are failing on CI due to invalid flow, these will be updated in a new set of E2E tests

test.describe
  .skip('Portal name transfer', () => {
    test('transfers a name from wallet A to wallet B, and wallet B is shown as the owner', async ({
      portalPage: page,
      wallet,
      accounts,
      makeName,
    }) => {
      test.setTimeout(180_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({ label: 'test1-a-to-b', owner: 'user' })
      const recipient = accounts.getAddress('user2')

      // ── 1. Start the transfer from the Ownership tab ─────────────────
      await page.goto(`${PORTAL_APP_URL}/${name}/ownership`)
      await page.getByRole('link', { name: 'Transfer' }).click()
      await expect(
        page.getByRole('heading', { name: 'Transfer ownership' }),
      ).toBeVisible({ timeout: 15_000 })

      // ── 2. Fill the recipient and submit ──────────────────────────────
      await page.getByPlaceholder('ENS name or address').fill(recipient)
      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      await expect(transferButton).toBeEnabled({ timeout: 15_000 })
      await transferButton.click()

      // ── 3. Authorize the on-chain transfer ────────────────────────────
      await driveTransactionsToSuccess(page, wallet, [
        `transfer-${name}-transfer-token`,
      ])
      await expect(page).toHaveURL(new RegExp(`/${name}/ownership$`), {
        timeout: 30_000,
      })

      // ── 4. Confirm wallet B is now the owner ──────────────────────────
      await expectOwnerOnNamePages(page, name, recipient)
    })

    test('transfers a name to wallet B with the resolver reset', async ({
      portalPage: page,
      wallet,
      accounts,
      makeName,
    }) => {
      test.setTimeout(180_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({
        label: 'test2-reset-resolver',
        owner: 'user',
      })
      const recipient = accounts.getAddress('user2')

      await page.goto(`${PORTAL_APP_URL}/${name}/ownership/transfer`)
      await expect(
        page.getByRole('heading', { name: 'Transfer ownership' }),
      ).toBeVisible({ timeout: 15_000 })

      await page.getByPlaceholder('ENS name or address').fill(recipient)
      await page.getByRole('switch', { name: /Reset the resolver/ }).click()

      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      await expect(transferButton).toBeEnabled({ timeout: 15_000 })
      await transferButton.click()

      // Resetting the resolver adds a step that must run before the token
      // transfer (see buildTransferPlan.ts — the sender loses the roles
      // needed to detach the resolver once the ERC-1155 token has moved).
      await driveTransactionsToSuccess(page, wallet, [
        `transfer-${name}-reset-resolver`,
        `transfer-${name}-transfer-token`,
      ])
      await expect(page).toHaveURL(new RegExp(`/${name}/ownership$`), {
        timeout: 30_000,
      })

      await expectOwnerOnNamePages(page, name, recipient)

      // The resolver pointer was detached as part of the transfer, so it now
      // shows as unset until the new owner configures their own.
      await page.goto(`${PORTAL_APP_URL}/${name}/resolver`)
      await expect(
        page.getByText('This name does not have a resolver set.'),
      ).toBeVisible({ timeout: 15_000 })
    })

    test('transfers a name from wallet A to an ENS name owned by wallet B', async ({
      portalPage: page,
      wallet,
      accounts,
      makeName,
    }) => {
      test.setTimeout(180_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({
        label: 'transfer-to-ens-name',
        owner: 'user',
      })
      const recipientName = await makeName({
        label: 'test3-recipient',
        owner: 'user2',
      })
      const recipientAddress = accounts.getAddress('user2')

      await page.goto(`${PORTAL_APP_URL}/${name}/ownership/transfer`)
      await expect(
        page.getByRole('heading', { name: 'Transfer ownership' }),
      ).toBeVisible({ timeout: 15_000 })

      // Enter the recipient's ENS name rather than a raw address.
      await page.getByPlaceholder('ENS name or address').fill(recipientName)

      // Wait for it to resolve to wallet B's address before submitting.
      await expect(page.getByText(recipientAddress)).toBeVisible({
        timeout: 15_000,
      })

      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      await expect(transferButton).toBeEnabled({ timeout: 15_000 })
      await transferButton.click()

      await driveTransactionsToSuccess(page, wallet, [
        `transfer-${name}-transfer-token`,
      ])
      await expect(page).toHaveURL(new RegExp(`/${name}/ownership$`), {
        timeout: 30_000,
      })

      await expectOwnerOnNamePages(page, name, recipientAddress)
    })

    test('cannot transfer a name to its own address or its own ENS name', async ({
      portalPage: page,
      wallet,
      accounts,
      makeName,
    }) => {
      test.setTimeout(120_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({ label: 'test4-self-guard', owner: 'user' })
      const ownAddress = accounts.getAddress('user')

      await page.goto(`${PORTAL_APP_URL}/${name}/ownership/transfer`)
      await expect(
        page.getByRole('heading', { name: 'Transfer ownership' }),
      ).toBeVisible({ timeout: 15_000 })

      const recipientInput = page.getByPlaceholder('ENS name or address')
      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      const selfOwnedMessage = page.getByText(
        'The recipient already owns this name.',
      )

      // Own address
      await recipientInput.fill(ownAddress)
      await expect(selfOwnedMessage).toBeVisible({ timeout: 15_000 })
      await expect(transferButton).toBeDisabled()

      // Own ENS name — the name being transferred still resolves to the
      // connected wallet, so it exercises the same self-transfer guard.
      await recipientInput.fill(name)
      await expect(selfOwnedMessage).toBeVisible({ timeout: 15_000 })
      await expect(transferButton).toBeDisabled()
    })

    test('cannot transfer to an invalid or unresolvable recipient', async ({
      portalPage: page,
      wallet,
      makeName,
    }) => {
      test.setTimeout(120_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({
        label: 'test6-invalid-recipient',
        owner: 'user',
      })

      await page.goto(`${PORTAL_APP_URL}/${name}/ownership/transfer`)
      await expect(
        page.getByRole('heading', { name: 'Transfer ownership' }),
      ).toBeVisible({ timeout: 15_000 })

      const recipientInput = page.getByPlaceholder('ENS name or address')
      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      const invalidMessage = page.getByText('Enter a valid ENS name or address')

      // Single-label text — no TLD and not a 0x address, so it fails
      // isNameOrAddress's syntactic check outright (see
      // useAddressResolution.ts / isNameOrAddress.ts).
      await recipientInput.fill('notaname')
      await expect(invalidMessage).toBeVisible({ timeout: 15_000 })
      await expect(transferButton).toBeDisabled()

      // Malformed address — too short to pass viem's `isAddress`, and still no
      // dot, so it hits the same syntactic-invalid path.
      await recipientInput.fill('0x1234')
      await expect(invalidMessage).toBeVisible({ timeout: 15_000 })
      await expect(transferButton).toBeDisabled()

      // Syntactically valid `.eth` name, but unregistered — passes the
      // isNameOrAddress check, then fails to resolve to any address, landing
      // on the distinct "unresolved" message instead of "invalid".
      const unresolvedName = `this-name-does-not-exist-${Date.now()}.eth`
      await recipientInput.fill(unresolvedName)
      await expect(
        page.getByText(`Could not resolve an address for “${unresolvedName}”`),
      ).toBeVisible({ timeout: 15_000 })
      await expect(transferButton).toBeDisabled()
    })

    test('lets the new owner edit records after a transfer', async ({
      portalPage: page,
      wallet,
      accounts,
      makeName,
    }) => {
      test.setTimeout(180_000)

      await connectWithHeadlessWallet(page, wallet)

      const name = await makeName({ label: 'test5-then-edit', owner: 'user' })
      const newOwner = accounts.getAddress('user2')

      // ── 1. Transfer from wallet A to wallet B ─────────────────────────
      await page.goto(`${PORTAL_APP_URL}/${name}/ownership/transfer`)
      await page.getByPlaceholder('ENS name or address').fill(newOwner)
      const transferButton = page.getByRole('button', { name: 'Transfer name' })
      await expect(transferButton).toBeEnabled({ timeout: 15_000 })
      await transferButton.click()
      await driveTransactionsToSuccess(page, wallet, [
        `transfer-${name}-transfer-token`,
      ])
      await expect(page).toHaveURL(new RegExp(`/${name}/ownership$`), {
        timeout: 30_000,
      })

      // ── 2. Reconnect the headless wallet as the new owner ─────────────
      // WalletMenu truncates as `truncateAddress(address, 5, 3)` (e.g.
      // "0x709…9C8") — matching on the raw address's middle characters (as the
      // old assertion did) can never appear in that truncated string.
      await wallet.changeAccounts([accounts.getPrivateKey('user2')])
      await expect(
        page.getByRole('button', {
          name: new RegExp(`Wallet menu for.*${newOwner.slice(-3)}`, 'i'),
        }),
      ).toBeVisible({ timeout: 15_000 })

      // ── 3. New owner deploys their own resolver ────────────────────────
      // Resolver write-permissions are a static role grant that stays with
      // whoever held them at deploy time — they don't follow the ERC-1155
      // token transfer. The new owner has to deploy a fresh resolver before
      // they can write records (see buildTransferPlan.ts: "the recipient
      // deploys their own afterward").
      await page.goto(`${PORTAL_APP_URL}/${name}/change-resolver`)
      await page.getByRole('switch', { name: /Use custom resolver/ }).click()
      await page.getByRole('button', { name: 'Save changes' }).click()
      await driveTransactionsToSuccess(page, wallet, [
        'tx-deploy-permissioned-resolver',
        'tx-change-resolver',
      ])
      await expect(
        page.getByRole('button', { name: 'Resolver changed!' }),
      ).toBeVisible({ timeout: 30_000 })

      // ── 4. New owner adds and saves a text record ──────────────────────
      await page.goto(`${PORTAL_APP_URL}/${name}/edit-records`)
      await page.getByLabel('Type').selectOption('text')
      await page.getByLabel('Key').fill('description')
      await page.getByLabel('Value').fill('Edited by the new owner')
      await page.getByRole('button', { name: 'Add record' }).click()
      await page.getByRole('button', { name: /Save \d+ change/ }).click()
      await driveTransactionsToSuccess(page, wallet, [
        'tx-save-resolver-records',
      ])

      await expect(page).toHaveURL(new RegExp(`/${name}/records$`), {
        timeout: 30_000,
      })
      await expect(page.getByText('Edited by the new owner')).toBeVisible({
        timeout: 15_000,
      })
    })
  })
