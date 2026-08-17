import { RenewPageLayout } from '../components/RenewPageLayout'
import { RenewalCompletionBanner } from '../renewing/components/RenewalCompletionBanner'
import { RenewalDetails } from '../renewing/components/RenewalDetails'

export const RenewSuccessStep = () => {
  return (
    <RenewPageLayout>
      <RenewalCompletionBanner />
      <RenewalDetails />
    </RenewPageLayout>
  )
}
