import { Trans } from '@lingui/react/macro'
import { AlertCircle } from 'lucide-react'
import { RegisterV2Context } from '../../../state/registrationUi.context'

const usePostRegistrationSetupFailed = RegisterV2Context.createSelector(
  (state) => state.context.postRegistrationSetupFailed,
)

/**
 * Shown when the name registered successfully but the optional primary-name
 * setup step failed or was rejected in the wallet.
 */
export const PrimaryNameSetupNotice = () => {
  const { uiActor } = RegisterV2Context.use()
  const setupFailed = usePostRegistrationSetupFailed(uiActor)

  if (!setupFailed) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-ens-orange-light bg-ens-yellow-light p-4">
      <AlertCircle
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-ens-orange"
      />
      <p className="text-ens-gray text-sm leading-5">
        <Trans>
          Your name was registered, but we couldn't set it as your primary name.
          You can set it anytime from your profile.
        </Trans>
      </p>
    </div>
  )
}
