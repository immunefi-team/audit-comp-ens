import { PrimaryNameSetupNotice } from '../registering/components/PrimaryNameSetupNotice'
import { RegistrationCompletionBanner } from '../registering/components/RegistrationCompletionBanner'
import { RegistrationDetails } from '../registering/components/RegistrationDetails'

export const SuccessStep = () => {
  return (
    <div className="mx-auto mt-12 mb-4 w-full-[32px] max-w-6xl space-y-6.5">
      <RegistrationCompletionBanner />
      <PrimaryNameSetupNotice />
      <RegistrationDetails />
    </div>
  )
}
