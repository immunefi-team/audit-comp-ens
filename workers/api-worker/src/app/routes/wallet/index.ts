import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import { vValidator } from '@hono/valibot-validator'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import {
  createClient,
  erc20Abi,
  type Hex,
  http,
  multicall3Abi,
  publicActions,
  walletActions,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { encodeFunctionData, parseEther, parseUnits } from 'viem/utils'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { KV_KEY } from '#core/kv/index.js'
import { hasV1Names } from '#services/v1-names/index.js'
import { logger } from '#utils/logger.js'
import { ethAddress } from '#utils/validation.js'

const TOKENS = {
  USDC: {
    address: ensL1Contracts[supportedL1Chains.sepolia].usdc.address,
    decimals: 6,
    mintAmount: parseUnits('1000', 6),
  },
  DAI: {
    address: ensL1Contracts[supportedL1Chains.sepolia].dai.address,
    decimals: 18,
    mintAmount: parseUnits('1000', 18),
  },
} as const

// Migration-gas ETH drip.
//
// The v1→v2 migration flow is entirely wallet-paid: direct setApprovalForAll
// transactions authorize the helper/HCA, then direct EOA transactions call
// HCA.executeByOwner for atomic resolver setup, migration, manager restoration,
// and profile replay. Nothing is Warp-sponsored. Batches are sized up to ~20M
// gas (TARGET_GAS in the manager), so the owner needs real sepETH — far more
// than the old one-shot approve drip.
//
// Gated server-side on BOTH:
//   1. the address owns at least one live v1 name (V1 subgraph existence
//      check — only owners with something to migrate get ETH), and
//   2. the address is below the target balance (top-up to target).
//
// SECURITY NOTE: this hands ETH to v1-name owners that hit the faucet.
// Acceptable for the testnet faucet only.
const MIGRATION_GAS_ETH_TARGET = parseEther('0.01')

// Standard ERC-20 reads (balanceOf) use viem's `erc20Abi`. Only
// `mint` is non-standard (MockERC20 faucet helper, not part of `erc20Abi`),
// so it stays a local fragment.
const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const createWalletClient = (privateKey: string | undefined, rpcUrl: string) => {
  if (!privateKey?.startsWith('0x')) {
    throw new HTTPException(500, {
      message: 'Server is not configured to fund wallets',
    })
  }

  const walletAccount = privateKeyToAccount(privateKey as Hex)
  logger.trace('Loaded wallet funding account', {
    walletAddress: walletAccount.address,
  })

  return createClient({
    chain: sepolia,
    // `batch: true` coalesces concurrent reads (the Promise.all below) into a
    // single JSON-RPC batch HTTP request — one round-trip without the on-chain
    // Multicall3 dependency.
    transport: http(rpcUrl, { batch: true }),
    account: walletAccount,
  })
    .extend(publicActions)
    .extend(walletActions)
}

export default createApp()
  .basePath('/wallet')
  .post(
    '/fund',
    injectDb,
    vValidator(
      'json',
      v.object({
        address: ethAddress,
      }),
    ),
    async (c) => {
      const { address } = c.req.valid('json')

      if (!c.env.SEPOLIA_RPC_URL) {
        throw new HTTPException(500, {
          message: 'Server is not configured with SEPOLIA_RPC_URL',
        })
      }

      // Setup wallet
      const walletClient = createWalletClient(
        c.env.ETH_PRIVATE_KEY,
        c.env.SEPOLIA_RPC_URL,
      )

      // Serialize funding per address. Without this, concurrent /wallet/fund
      // calls for the same address each read the same (low) balances and each
      // mint + drip ETH — double-spending faucet funds and racing the funder's
      // nonce. A
      // short-lived KV lock lets only one in-flight fund per address proceed;
      // others no-op. KV is best-effort across colos (fine for a testnet
      // faucet), and the TTL self-heals if a fund crashes mid-flight.
      const lockKey = KV_KEY.WALLET.FUND_LOCK(address)
      if (await c.env.KV.get(lockKey)) {
        logger.debug('Fund already in progress for address, skipping', {
          address,
        })
        return c.json({ txHash: null })
      }
      await c.env.KV.put(lockKey, 'locked', { expirationTtl: 60 })

      let txHash: Hex | null = null
      try {
        // All reads go out in a single JSON-RPC batch (see `batch: true` on
        // the transport): both token balances plus the native ETH balance.
        const [usdcBalance, daiBalance, ethBalance] = await Promise.all([
          walletClient.readContract({
            address: TOKENS.USDC.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }),
          walletClient.readContract({
            address: TOKENS.DAI.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }),
          walletClient.getBalance({ address }),
        ])

        logger.debug('Checked faucet state', {
          usdcBalance,
          daiBalance,
          ethBalance,
          address,
        })

        // 1) Mint mock USDC/DAI unless the address already has enough (anti-abuse).
        const hasEnoughTokens =
          usdcBalance >= TOKENS.USDC.mintAmount / 10n &&
          daiBalance >= TOKENS.DAI.mintAmount / 10n
        if (hasEnoughTokens) {
          logger.debug('Already have enough tokens, skipping mint', {
            usdcBalance,
            daiBalance,
            address,
          })
        } else {
          const multicallTxHash = await walletClient.writeContract({
            address: sepolia.contracts.multicall3.address,
            abi: multicall3Abi,
            functionName: 'aggregate3',
            args: [
              [
                {
                  target: TOKENS.USDC.address,
                  allowFailure: false,
                  callData: encodeFunctionData({
                    abi: MINT_ABI,
                    functionName: 'mint',
                    args: [address, TOKENS.USDC.mintAmount],
                  }),
                },
                {
                  target: TOKENS.DAI.address,
                  allowFailure: false,
                  callData: encodeFunctionData({
                    abi: MINT_ABI,
                    functionName: 'mint',
                    args: [address, TOKENS.DAI.mintAmount],
                  }),
                },
              ],
            ],
          })

          logger.debug('Mint multicall sent', {
            multicall: multicallTxHash,
            address,
          })

          const receipt = await walletClient.waitForTransactionReceipt({
            hash: multicallTxHash,
          })

          logger.debug('Mint multicall confirmed', { receipt, address })
          txHash = receipt.transactionHash
        }

        // 2) Migration-gas ETH drip — top the address up to the target when
        // it's low AND it actually owns v1 names (see MIGRATION_GAS_ETH_TARGET
        // above). Checked in this order so the subgraph is only queried when a
        // drip is actually on the table (after a successful drip the balance
        // sits at the target, short-circuiting subsequent calls). Best-effort:
        // a failed check or drip must never fail token funding.
        if (ethBalance >= MIGRATION_GAS_ETH_TARGET) {
          logger.debug('Address has enough ETH, skipping migration-gas drip', {
            ethBalance,
            address,
          })
        } else {
          try {
            // Fail-closed: a subgraph error throws and skips the drip.
            const ownsV1Names = await hasV1Names(address)
            if (!ownsV1Names) {
              logger.debug('Address owns no v1 names, skipping drip', {
                address,
              })
            } else {
              const value = MIGRATION_GAS_ETH_TARGET - ethBalance
              const dripTxHash = await walletClient.sendTransaction({
                to: address,
                value,
              })
              logger.debug('Migration-gas ETH drip sent', {
                dripTxHash,
                value,
                address,
              })
              await walletClient.waitForTransactionReceipt({
                hash: dripTxHash,
              })
              logger.debug('Migration-gas ETH drip confirmed', {
                dripTxHash,
                address,
              })
            }
          } catch (error) {
            // Best-effort: the owner can still top up from a public faucet.
            logger.error('Migration-gas ETH drip failed', { address, error })
          }
        }
      } finally {
        await c.env.KV.delete(lockKey)
      }

      // Preserve the two-shape response so the inferred hc type stays
      // `{ txHash: Hex } | { txHash: null }` (what the manager expects).
      return txHash ? c.json({ txHash }) : c.json({ txHash: null })
    },
  )
  // Source of truth for which mock stablecoins this worker actually mints.
  // The manager reads balances against whatever addresses this returns, so the
  // UI can never drift from the faucet again (e.g. when the deployed worker and
  // the app are built against different ensjs token-address pins). Derived from
  // the same `TOKENS` config used by `/fund`, so the two can't disagree.
  .get('/tokens', (c) =>
    c.json({
      chainId: sepolia.id,
      tokens: {
        USDC: {
          address: TOKENS.USDC.address,
          decimals: TOKENS.USDC.decimals,
          symbol: 'USDC' as const,
        },
        DAI: {
          address: TOKENS.DAI.address,
          decimals: TOKENS.DAI.decimals,
          symbol: 'DAI' as const,
        },
      },
    }),
  )
