import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { type Address, erc20Abi } from 'viem'
import { useConfig, useConnection } from 'wagmi'
import { readContractsQueryOptions } from 'wagmi/query'
import { MessageCard } from '@/components/ui/message-card'
import { PaymentTokenList } from '@/features/register/components/PaymentTokenList'
import { PAYMENT_TOKENS } from '@/features/register/constants/paymentTokens'
import { getRegistrationPriceQueryOptions } from '@/features/register/hooks/useRegistrationPrice'
import { getRenewalPriceQueryOptions } from '@/features/register/hooks/useRenewalPrice'
import { getRenewerAddress } from '@/features/renew/utils/renewer'
import { sepoliaWithEns } from '@/lib/wagmi'
import {
  buildTokenData,
  type TokenWithPriceAndBalance,
} from '../utils/tokenData'

const ethRegistrar = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensEthRegistrar',
})

const Skeleton = () => (
  <div className="space-y-4">
    <div className="h-5 w-40 bg-muted animate-pulse rounded-md" />
    <div className="space-y-2">
      <div className="h-16 w-full bg-muted animate-pulse rounded-sm" />
      <div className="h-16 w-full bg-muted animate-pulse rounded-sm" />
    </div>
  </div>
)

type PaymentTokenPickerProps = {
  readonly name: string
  readonly duration: number
  /**
   * A submit transaction is in flight — disables token selection while it runs.
   * Only the register flow sets this; renewals leave it unset. This is a pending
   * flag, not the register/renew discriminant — that's `mode`.
   */
  readonly isSubmitting?: boolean
  readonly onSelectionChange: (token: TokenWithPriceAndBalance | null) => void
} & (
  | {
      readonly mode: 'renew'
      /** Whether the name is v2-native/migrated; selects the renewer contract. */
      readonly isV2: boolean
    }
  | {
      readonly mode?: 'register'
      readonly isV2?: never
    }
)

export const PaymentTokenPicker = (props: PaymentTokenPickerProps) => {
  const { name, duration, isSubmitting = false, onSelectionChange } = props
  const config = useConfig()
  const { address } = useConnection()
  const [selectedToken, setSelectedToken] = useState<Address | null>(null)

  const spender =
    props.mode === 'renew' ? getRenewerAddress(props.isV2) : ethRegistrar

  const balancesQuery = useQuery({
    ...readContractsQueryOptions(config, {
      contracts: PAYMENT_TOKENS.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })),
    }),
    enabled: Boolean(address),
    staleTime: 0,
  })

  const allowancesQuery = useQuery({
    ...readContractsQueryOptions(config, {
      contracts: PAYMENT_TOKENS.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, spender],
      })),
    }),
    enabled: Boolean(address),
    staleTime: 0,
  })

  const priceQueries = useQueries({
    queries: PAYMENT_TOKENS.map((token) =>
      props.mode === 'renew'
        ? getRenewalPriceQueryOptions({
            name,
            duration,
            token: token.address,
            renewerAddress: spender,
          })
        : getRegistrationPriceQueryOptions({
            name,
            duration,
            token: token.address,
          }),
    ),
  })

  if (
    balancesQuery.isLoading ||
    allowancesQuery.isLoading ||
    priceQueries.some((query) => query.isLoading)
  ) {
    return <Skeleton />
  }

  if (!address) {
    return (
      <MessageCard
        icon={<AlertTriangle className="size-6" />}
        title="Connect your wallet"
        className="xl:min-w-none"
        description="Connect your wallet to view available payment tokens for your ENS registration."
      />
    )
  }

  if (!balancesQuery.data) {
    return null
  }

  const balances = balancesQuery.data.map((balance) =>
    balance.status === 'success' && balance.result !== undefined
      ? BigInt(balance.result)
      : 0n,
  )

  const allowances = (allowancesQuery.data ?? []).map((allowance) =>
    allowance.status === 'success' && allowance.result !== undefined
      ? BigInt(allowance.result)
      : 0n,
  )

  const tokenData = buildTokenData(
    PAYMENT_TOKENS,
    priceQueries.map((query) => query.data),
    balances,
    allowances,
  )

  const noSupportedTokenHasSufficientBalance = tokenData.every(
    (token) => token.balance < token.price.total,
  )

  const handleSelect = (token: TokenWithPriceAndBalance) => {
    setSelectedToken(token.address)
    onSelectionChange(token)
  }

  return (
    <>
      <h2 id="payment-heading" className="text-lg font-medium">
        Select payment method
      </h2>
      {noSupportedTokenHasSufficientBalance ? (
        <MessageCard
          variant="warning"
          icon={<AlertTriangle className="size-6" />}
          title="Insufficient balance"
          className="xl:min-w-none"
          description={
            props.mode === 'renew'
              ? "You'll need to hold USDC or DAI in your connected wallet in order to extend your ENS name."
              : "You'll need to hold USDC or DAI in your connected wallet in order to complete the registration of your ENS name."
          }
        />
      ) : (
        <PaymentTokenList
          tokenData={tokenData}
          selectedToken={selectedToken}
          isRegistering={isSubmitting}
          onSelect={handleSelect}
        />
      )}
    </>
  )
}
