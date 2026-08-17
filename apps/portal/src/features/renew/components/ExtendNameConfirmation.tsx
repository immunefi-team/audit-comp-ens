import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { PaymentTokenPicker } from '@/features/register/components/PaymentTokenPicker'
import type { RegistrationPriceResult } from '@/features/register/hooks/useRegistrationPrice'
import type { TokenWithPriceAndBalance } from '@/features/register/utils/tokenData'
import type { SelectedName } from '../hooks/useRenewalTransactions'
import { ExtendNameSummaryCards } from './ExtendNameSummaryCards'

type ExtendNameConfirmationProps = {
  readonly selectedName: SelectedName
  readonly durationSeconds: number
  readonly price: RegistrationPriceResult
  readonly onBack: () => void
  readonly onConfirm: (token: TokenWithPriceAndBalance) => void
}

export const ExtendNameConfirmation = ({
  selectedName,
  durationSeconds,
  price,
  onBack,
  onConfirm,
}: ExtendNameConfirmationProps) => {
  const [selectedTokenData, setSelectedTokenData] =
    useState<TokenWithPriceAndBalance | null>(null)

  return (
    <div className="space-y-6 mt-2">
      <div className="flex items-center gap-2">
        <NameAvatar name={selectedName.name} height="60px" width="60px" />
        <h2 className="text-h2 w-max text-foreground">{selectedName.name}</h2>
      </div>
      <ExtendNameSummaryCards
        durationSeconds={durationSeconds}
        price={price}
        baseDate={selectedName.expiryDate ?? undefined}
      />
      <PaymentTokenPicker
        name={selectedName.name}
        duration={durationSeconds}
        mode="renew"
        isV2={selectedName.isV2}
        onSelectionChange={setSelectedTokenData}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          className="flex-1"
          variant="default"
          disabled={!selectedTokenData}
          onClick={() => selectedTokenData && onConfirm(selectedTokenData)}
        >
          Confirm
        </Button>
      </div>
    </div>
  )
}
