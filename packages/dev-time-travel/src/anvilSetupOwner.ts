import {
  type Address,
  type Chain,
  createPublicClient,
  createTestClient,
  createWalletClient,
  erc20Abi,
  http,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readContract } from 'viem/actions'
import { TIME_TRAVEL_RPC } from './config'

// Well-known Anvil #0 key — publicly documented, not a secret.
const ANVIL_FUNDER_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const ERC20_MINT_ABI = parseAbi(['function mint(address to, uint256 amount)'])
const USDC_MINT_AMOUNT = 10_000_000_000n // 10,000 USDC (6 decimals)
const DAI_MINT_AMOUNT = 10_000_000_000_000_000_000_000n // 10,000 DAI (18 decimals)

/**
 * Dev-only: clears contract bytecode at `address` on the local Anvil fork and
 * mints USDC (and DAI, when a DAI address is supplied) to it.
 *
 * Why setCode: some Anvil-derived addresses coincide with Sepolia contracts
 * (e.g. well-known account 0xf39F...2266 has an EOF contract deployed on Sepolia).
 * The ENS registrar calls `_safeMint` on the registration owner, which triggers
 * an ERC1155 receiver check — if that address has non-receiver bytecode the TX
 * reverts. Wiping the code makes it a plain EOA on the fork.
 *
 * Accepts `chain` and `tokens` as parameters so this package stays app-agnostic —
 * the caller (SmartAccountContext) passes in its own wagmi chain and token addresses
 * rather than this package importing manager-specific config.
 */
export async function anvilSetupOwner(
  address: Address,
  chain: Chain,
  tokens: { USDC: Address; DAI?: Address },
): Promise<void> {
  const transport = http(TIME_TRAVEL_RPC)
  const testClient = createTestClient({ chain, mode: 'anvil', transport })
  const publicClient = createPublicClient({ chain, transport })
  const anvilFunder = privateKeyToAccount(ANVIL_FUNDER_KEY)
  const walletClient = createWalletClient({
    account: anvilFunder,
    chain,
    transport,
  })

  await testClient.setCode({ address, bytecode: '0x' })

  const daiAddress = tokens.DAI
  const [usdcBal, daiBal] = await Promise.all([
    readContract(publicClient, {
      address: tokens.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    }),
    daiAddress
      ? readContract(publicClient, {
          address: daiAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        })
      : undefined,
  ])

  const mints: Promise<`0x${string}`>[] = []
  if (usdcBal < USDC_MINT_AMOUNT) {
    mints.push(
      walletClient.writeContract({
        address: tokens.USDC,
        abi: ERC20_MINT_ABI,
        functionName: 'mint',
        args: [address, USDC_MINT_AMOUNT],
      }),
    )
  }
  if (daiAddress && daiBal !== undefined && daiBal < DAI_MINT_AMOUNT) {
    mints.push(
      walletClient.writeContract({
        address: daiAddress,
        abi: ERC20_MINT_ABI,
        functionName: 'mint',
        args: [address, DAI_MINT_AMOUNT],
      }),
    )
  }
  await Promise.all(mints)
}
