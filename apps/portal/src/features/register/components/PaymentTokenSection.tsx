import { useState } from 'react'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import type { TokenWithPriceAndBalance } from '../utils/tokenData'
import { PaymentTokenPicker } from './PaymentTokenPicker'

type PaymentTokenSectionProps = {
  readonly name: string
  readonly duration: number
  readonly onConfirm: (selectedToken: Address, tokenPrice: bigint) => void
  readonly onConnectWallet?: () => void
  readonly isConnected: boolean
  readonly isRegistering?: boolean
}

export const PaymentTokenSection = ({
  name,
  duration,
  onConfirm,
  onConnectWallet,
  isConnected,
  isRegistering = false,
}: PaymentTokenSectionProps) => {
  const [selectedTokenData, setSelectedTokenData] =
    useState<TokenWithPriceAndBalance | null>(null)

  if (!isConnected) {
    return (
      <Button
        className="w-full max-w-xs mx-auto"
        onClick={onConnectWallet}
        disabled={typeof onConnectWallet !== 'function'}
        type="button"
      >
        {typeof onConnectWallet === 'function'
          ? 'Connect to register'
          : 'Wallet not connected'}
      </Button>
    )
  }

  const handleBuyName = () => {
    if (selectedTokenData) {
      onConfirm(selectedTokenData.address, selectedTokenData.price.total)
    }
  }

  return (
    <section
      className="border border-border rounded-xl p-6 space-y-4"
      aria-labelledby="payment-heading"
    >
      <PaymentTokenPicker
        name={name}
        duration={duration}
        isSubmitting={isRegistering}
        onSelectionChange={setSelectedTokenData}
      />
      <Button
        className="w-full"
        onClick={handleBuyName}
        disabled={!selectedTokenData}
        variant="default"
      >
        {isRegistering ? 'Registering...' : 'Register'}
      </Button>
    </section>
  )
}
