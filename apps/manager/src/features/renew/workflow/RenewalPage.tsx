import { match, P } from 'ts-pattern'
import {
  RenewalUiProvider,
  useRenewalUiContext,
} from '../state/renewalUi.context'
import { useRenewalStep } from '../state/renewalUi.selectors'
import type { RenewalProtocol } from '../utils/renewalProtocol'
import { RenewPricingStep } from './pricing/PricingStep'
import { RenewingStep } from './renewing/RenewingStep'
import { RenewFailureStep } from './result/FailureStep'
import { RenewSuccessStep } from './result/SuccessStep'

export const RenewalPage = ({
  currentExpiry,
  label,
  protocol,
}: {
  readonly currentExpiry: bigint
  readonly label: string
  readonly protocol: RenewalProtocol
}) => (
  <RenewalUiProvider
    currentExpiry={currentExpiry}
    label={label}
    protocol={protocol}
  >
    <RenewalPageContent />
  </RenewalUiProvider>
)

const RenewalPageContent = () => {
  const { uiActor } = useRenewalUiContext()
  const step = useRenewalStep(uiActor)

  return match(step)
    .with('pricing', () => <RenewPricingStep />)
    .with(
      P.union(
        'checkingAllowance',
        'submittingTokenApproval',
        'waitingForTokenApproval',
        'submittingRenewal',
        'submittingPlainRenewal',
        'waitingForRenewal',
      ),
      () => <RenewingStep />,
    )
    .with('success', () => <RenewSuccessStep />)
    .with('failure', () => <RenewFailureStep />)
    .exhaustive()
}
