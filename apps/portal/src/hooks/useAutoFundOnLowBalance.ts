import { anvilSetupOwner, isTimeTravelEnabled } from '@ens-apps/dev-time-travel'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { useConnection, useReadContracts } from 'wagmi'
import { PAYMENT_TOKENS } from '@/features/register/constants/paymentTokens'
import { useFundWallet } from './useFundWallet'

const LOW_BALANCE_THRESHOLD = 500n

/**
 * Auto-funds the connected wallet when USDC+DAI balance is below threshold.
 * Matches the manager app pattern: runs when wallet is connected.
 *
 * In dev mode (`VITE_TIME_TRAVEL=1`) uses local Anvil mint directly instead
 * of the external API, and also clears any contract bytecode at the account
 * address to prevent ERC1155 receiver check failures during registration.
 */
export function useAutoFundOnLowBalance() {
  const { address } = useConnection()

  // Track which addresses we've already set up in this session so we don't
  // repeat the setCode + mint on every render.
  const setupDoneRef = useRef<Set<string>>(new Set())

  const {
    data: balances = [],
    isLoading: isLoadingBalances,
    refetch: refetchBalances,
  } = useReadContracts({
    contracts: PAYMENT_TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
    })),
    query: { enabled: Boolean(address) },
  })

  const fundWalletMutation = useFundWallet({
    onSuccess: (data) => {
      if (data?.txHash) {
        toast.success('Wallet funded', {
          description: 'Your wallet has been topped up with test USDC & DAI.',
          id: `fund-wallet-${address}`,
        })
        refetchBalances()
      } else {
        toast.dismiss(`fund-wallet-${address}`)
      }
    },
    onError: (error) => {
      toast.error('Failed to fund wallet', {
        description: error.message,
        id: `fund-wallet-${address}`,
      })
    },
  })

  // Time-travel only: clear bytecode + mint tokens directly on the Anvil fork.
  // Falls back to the external API if the RPC doesn't support anvil_* methods
  // (i.e. running against real Sepolia without time travel).
  useEffect(() => {
    if (!isTimeTravelEnabled() || !address) return
    if (setupDoneRef.current.has(address)) return

    setupDoneRef.current.add(address)
    toast.loading('Setting up dev wallet', {
      description: 'Clearing bytecode and minting test tokens on Anvil...',
      id: `anvil-setup-${address}`,
    })
    anvilSetupOwner(address, sepolia, {
      USDC: PAYMENT_TOKENS[0].address,
      DAI: PAYMENT_TOKENS[1].address,
    })
      .then(() => {
        toast.success('Dev wallet ready', {
          description: 'Bytecode cleared and USDC/DAI minted.',
          id: `anvil-setup-${address}`,
        })
        refetchBalances()
      })
      .catch(() => {
        // anvil_* methods not available — we're on real Sepolia in dev mode.
        // Remove from setupDone so the external-API effect can handle it.
        setupDoneRef.current.delete(address)
        toast.dismiss(`anvil-setup-${address}`)
      })
  }, [address, refetchBalances])

  // External API path: used in production, or in dev when Anvil setup failed
  // (i.e. connected to real Sepolia). Skipped if Anvil setup already ran.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Should not rerun from mutation status
  useEffect(() => {
    if (isTimeTravelEnabled() && setupDoneRef.current.has(address ?? '')) return
    if (!address || isLoadingBalances || fundWalletMutation.isPending) return

    const totalBalance = balances.reduce((acc, balance, i) => {
      if (balance.status !== 'success' || balance.result === undefined)
        return acc
      const decimals = PAYMENT_TOKENS[i].decimals
      return acc + BigInt(balance.result) / BigInt(10 ** decimals)
    }, 0n)

    if (totalBalance >= LOW_BALANCE_THRESHOLD) return

    toast.loading('Funding wallet', {
      description: 'Topping up your wallet with test USDC & DAI...',
      id: `fund-wallet-${address}`,
    })
    fundWalletMutation.mutate(address)
  }, [address, isLoadingBalances, balances])
}
