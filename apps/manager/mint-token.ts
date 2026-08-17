#!/usr/bin/env tsx

import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatUnits,
  type Hex,
  http,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { customSepolia, SEPOLIA_RPC_URL } from './src/lib/wagmi'

// Configuration
const SMART_ACCOUNT: Address =
  '0x590876cF134c728F5646CEC08105e2B27a825351' as Address // EOA address to fund
const MINT_AMOUNT = parseUnits('1000', 18) // 1000 tokens (DAI has 18 decimals)
const USDC_MINT_AMOUNT = parseUnits('1000', 6) // 1000 USDC (USDC has 6 decimals)

// Mock token addresses sourced from the ensjs Sepolia chain config — the same
// source the app reads payment tokens from. Hardcoding drifts from the app's
// tokens whenever ensjs bumps the deployment.
const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]
const MOCK_USDC_ADDRESS: Address = ensjsSepolia.usdc.address
const MOCK_DAI_ADDRESS: Address = ensjsSepolia.dai.address

// ERC20 ABI for mint function (assuming these are mock tokens with mint function)
const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable' as const,
    type: 'function' as const,
  },
  {
    inputs: [{ name: 'account', type: 'address' as const }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
] as const

async function mintTokens(): Promise<void> {
  // Check if private key is provided
  let privateKey = process.env.PRIVATE_KEY

  if (!privateKey) {
    console.error('❌ Please set PRIVATE_KEY environment variable')
    console.log('Example: PRIVATE_KEY=0x... tsx mint-tokens.ts')
    process.exit(1)
  }

  // Ensure private key has 0x prefix
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey as Hex)

  // Create clients using customSepolia configuration
  const publicClient = createPublicClient({
    chain: customSepolia,
    transport: http(SEPOLIA_RPC_URL),
  })

  const walletClient = createWalletClient({
    chain: customSepolia,
    transport: http(SEPOLIA_RPC_URL),
    account, // Pass the account object, not the private key
  })

  const walletAddress = account.address
  console.log(`🔑 Using wallet: ${walletAddress}`)
  console.log(`🎯 Minting tokens to: ${SMART_ACCOUNT}`)
  console.log('')

  try {
    // Check wallet balance
    const balance = await publicClient.getBalance({
      address: walletAddress,
    })
    console.log(`💰 Wallet balance: ${formatUnits(balance, 18)} ETH`)

    if (balance < parseUnits('0.001', 18)) {
      console.error(
        '❌ Insufficient ETH for gas fees. Please fund your wallet.',
      )
      process.exit(1)
    }

    // Mint DAI
    console.log('🪙 Minting DAI...')
    const daiTxHash = await walletClient.writeContract({
      address: MOCK_DAI_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [SMART_ACCOUNT, MINT_AMOUNT],
    })

    console.log(`📝 DAI mint transaction: ${daiTxHash}`)

    // Wait for DAI transaction
    const daiReceipt = await publicClient.waitForTransactionReceipt({
      hash: daiTxHash,
    })
    console.log(`✅ DAI minted successfully! Gas used: ${daiReceipt.gasUsed}`)

    // Mint USDC
    console.log('🪙 Minting USDC...')
    const usdcTxHash = await walletClient.writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [SMART_ACCOUNT, USDC_MINT_AMOUNT],
    })

    console.log(`📝 USDC mint transaction: ${usdcTxHash}`)

    // Wait for USDC transaction
    const usdcReceipt = await publicClient.waitForTransactionReceipt({
      hash: usdcTxHash,
    })
    console.log(`✅ USDC minted successfully! Gas used: ${usdcReceipt.gasUsed}`)

    // Check final balances
    console.log('')
    console.log('📊 Final token balances:')

    const daiBalance = await publicClient.readContract({
      address: MOCK_DAI_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [SMART_ACCOUNT],
    })

    const usdcBalance = await publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [SMART_ACCOUNT],
    })

    console.log(`🪙 DAI balance: ${formatUnits(daiBalance, 18)}`)
    console.log(`🪙 USDC balance: ${formatUnits(usdcBalance, 6)}`)

    console.log('')
    console.log('🎉 Token minting completed successfully!')
    console.log(`📍 Rhinestone account: ${SMART_ACCOUNT}`)
  } catch (error) {
    console.error('❌ Error minting tokens:', error)

    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      if ('cause' in error) {
        console.error('Error cause:', error.cause)
      }
    }

    process.exit(1)
  }
}

// Run the script
mintTokens().catch(console.error)
