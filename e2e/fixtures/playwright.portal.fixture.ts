import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import {
  injectHeadlessWeb3Provider,
  type Web3ProviderBackend,
} from '@ensdomains/headless-web3-provider'
import type { Page } from '@playwright/test'
import { test as base } from '@playwright/test'
import {
  type Account,
  type Address,
  bytesToHex,
  encodeFunctionData,
  type Hash,
  parseAbi,
} from 'viem'
import {
  mnemonicToAccount,
  nonceManager,
  privateKeyToAccount,
} from 'viem/accounts'
import { sepolia } from 'viem/chains'
import {
  publicClient,
  testClient,
  walletClient,
} from '../helpers/anvil-client.js'
import {
  connectWithHeadlessWallet,
  type PortalAccounts,
} from '../helpers/portal-auth.js'
import { createMakeName } from './makeName.js'
import { createTime, type Time } from './time.js'

// Override Sepolia chain to point at the local Anvil fork.
// The headless provider's internal walletClient uses this RPC URL
// to estimate gas and submit transactions.
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'
const localSepolia = {
  ...sepolia,
  rpcUrls: {
    default: { http: [ANVIL_RPC_URL] },
  },
} as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load the e2e `.env` natively (replaces `dotenv`). `process.loadEnvFile`
// throws if the file is missing, so guard on existence to keep the previous
// silent-when-absent behaviour.
const envPath = path.resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

// ---------------------------------------------------------------------------
// Accounts — derived from the default Anvil mnemonic
// Account 0 (0xf39F…2266) has 10 000 ETH on any Anvil fork.
// ---------------------------------------------------------------------------
const DEFAULT_MNEMONIC =
  'test test test test test test test test test test test junk'
// Resolve payment-token addresses from the ensjs Sepolia chain config — the
// SAME source as `@ens-apps/transaction-manager`'s `SUPPORTED_TOKENS` (which
// the portal's payment-token picker reads) and the other e2e fixtures
// (see makeName.ts / makeV2Name.ts). Hardcoding drifts from the app's tokens.
const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]
const MOCK_USDC = ensjsSepolia.usdc.address
const MOCK_DAI = ensjsSepolia.dai.address
const ANVIL_FUNDER = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function balanceOf(address owner) view returns (uint256)',
])

const users = ['user', 'user2', 'user3', 'user4'] as const
export type User = (typeof users)[number]

export function createAccounts(): PortalAccounts {
  const mnemonic = DEFAULT_MNEMONIC

  const { accounts, privateKeys } = users.reduce<{
    accounts: Account[]
    privateKeys: Hash[]
  }>(
    (acc, _, index) => {
      const { getHdKey } = mnemonicToAccount(mnemonic, {
        addressIndex: index,
      })
      const privateKey = bytesToHex(getHdKey().privateKey!)
      const account = privateKeyToAccount(privateKey, { nonceManager })
      return {
        accounts: [...acc.accounts, account],
        privateKeys: [...acc.privateKeys, privateKey],
      }
    },
    { accounts: [], privateKeys: [] },
  )

  return {
    getAddress: (user: User = 'user'): Address => {
      const index = users.indexOf(user)
      if (index < 0) throw new Error(`User not found: ${user}`)
      return accounts[index].address
    },
    getAllPrivateKeys: () => privateKeys,
    getPrivateKey: (user: User = 'user') => {
      const index = users.indexOf(user)
      if (index < 0) throw new Error(`User not found: ${user}`)
      return privateKeys[index]
    },
  }
}

async function waitForTx(hash: Hash) {
  await publicClient.waitForTransactionReceipt({ hash })
}

// Anvil's default mnemonic ("test test test ... junk") is public, so its
// derived addresses are widely known. Bots watch live Sepolia for funds
// landing on them and sweep automatically — some via an EIP-7702 delegation,
// which the fork inherits as real contract bytecode. That turns a plain
// recipient EOA into an ERC1155 receiver whose callback doesn't return the
// correct magic value, reverting any `safeTransferFrom` to it (e.g.
// transfer.spec.ts sending to `user2`). Wiping the code restores a plain EOA
// on the fork. Clear it for every test account, since any of them can end up
// as a transfer recipient or registration owner.
async function clearAnvilSquattedCode(address: Address) {
  await testClient.setCode({ address, bytecode: '0x' })
}

async function ensurePortalStablecoinBalances(address: Address) {
  const [usdcBalance, daiBalance] = await Promise.all([
    publicClient.readContract({
      address: MOCK_USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
    publicClient.readContract({
      address: MOCK_DAI,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
  ])

  if (usdcBalance < 10_000_000_000n) {
    const mintUsdcData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address, 10_000_000_000n], // 10_000 USDC (6 decimals)
    })
    const hash = await walletClient.sendTransaction({
      account: ANVIL_FUNDER,
      to: MOCK_USDC,
      data: mintUsdcData,
    })
    await waitForTx(hash)
  }

  if (daiBalance < 10_000_000_000_000_000_000_000n) {
    const mintDaiData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address, 10_000_000_000_000_000_000_000n], // 10_000 DAI (18 decimals)
    })
    const hash = await walletClient.sendTransaction({
      account: ANVIL_FUNDER,
      to: MOCK_DAI,
      data: mintDaiData,
    })
    await waitForTx(hash)
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
type PortalFixtures = {
  /** Headless web3 wallet backend — use to authorize transactions. */
  wallet: Web3ProviderBackend
  /** Test accounts derived from the Anvil mnemonic. */
  accounts: PortalAccounts
  /** Page with the headless wallet already injected (but NOT connected). */
  portalPage: Page
  /** Time fixture for syncing anvil block time with the browser clock. */
  time: Time
  /** Register names on the anvil fork (supports expired / premium states). */
  makeName: ReturnType<typeof createMakeName>
}

export const test = base.extend<PortalFixtures>({
  accounts: async ({}, use) => {
    await use(createAccounts())
  },

  wallet: async ({ page, accounts }, use) => {
    await Promise.all(
      users.map((user) => clearAnvilSquattedCode(accounts.getAddress(user))),
    )
    await ensurePortalStablecoinBalances(accounts.getAddress('user'))
    const privateKeys = accounts.getAllPrivateKeys()
    const wallet = await injectHeadlessWeb3Provider({
      page,
      privateKeys,
      chains: [localSepolia],
    })
    await use(wallet)
  },

  portalPage: async ({ page, wallet }, use) => {
    const baseURL = process.env.PORTAL_APP_URL ?? 'http://localhost:3001'
    await page.goto(baseURL)
    // Brief wait for app initialisation
    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForTimeout(5_000),
    ]).catch(() => {})
    await use(page)
  },

  time: async ({ page }, use) => {
    await use(createTime({ page }))
  },

  makeName: async ({ accounts, time }, use) => {
    await use(createMakeName({ accounts, time }))
  },
})

export { expect } from '@playwright/test'
export { connectWithHeadlessWallet } from '../helpers/portal-auth.js'
