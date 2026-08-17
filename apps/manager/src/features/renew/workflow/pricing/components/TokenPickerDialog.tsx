import { useLingui } from '@lingui/react/macro'
import { useSelector } from '@xstate/react'
import { match, P } from 'ts-pattern'
import { PaymentDialogBase } from '@/features/register-v2/workflow/pricing/components/TokenPickerDialog'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { ConfirmPurchase } from './ConfirmPurchase'
import { TokenPickerContent } from './TokenPickerContent'

export const TokenPickerDialog = () => {
  const { t } = useLingui()
  const { uiActor } = useRenewalUiContext()

  const pricingStep = useSelector(uiActor, (state) =>
    match(state.value)
      .with({ pricing: P.string }, (step) => step.pricing)
      .otherwise(() => undefined),
  )

  const isOpen = pricingStep === 'tokens' || pricingStep === 'confirm'

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (pricingStep === 'confirm') {
        uiActor.send({ type: 'pricing.dialog.dismiss' })
      } else if (pricingStep === 'tokens') {
        uiActor.send({ type: 'pricing.step.previous' })
      }
    }
  }

  return (
    <PaymentDialogBase
      onOpenChange={handleOpenChange}
      open={isOpen}
      title={match(pricingStep)
        .with('tokens', () => t`Select coin`)
        .with('confirm', () => t`Confirm purchase`)
        .otherwise(() => undefined)}
    >
      {match(pricingStep)
        .with('tokens', () => <TokenPickerContent />)
        .with('confirm', () => <ConfirmPurchase />)
        .otherwise(() => undefined)}
    </PaymentDialogBase>
  )
}
