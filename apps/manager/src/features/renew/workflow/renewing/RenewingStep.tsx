import { useLingui } from '@lingui/react/macro'
import { useBlocker } from '@tanstack/react-router'
import { useSelector } from '@xstate/react'
import { match } from 'ts-pattern'
import { RegistrationProgressBar } from '@/features/register-v2/workflow/registering/components/RegistrationProgressBar'
import { useRenewalUiContext } from '../../state/renewalUi.context'
import { useRenewalStep } from '../../state/renewalUi.selectors'
import { RenewalDetails } from './components/RenewalDetails'

export const RenewingStep = () => {
  const { t } = useLingui()
  const { uiActor } = useRenewalUiContext()
  const step = useRenewalStep(uiActor)
  const isRenewing = useSelector(uiActor, (state) => state.hasTag('renewing'))

  useBlocker({
    shouldBlockFn: () => {
      if (!isRenewing) {
        return false
      }

      const shouldLeave = confirm(
        t`Your renewal is in progress. Leaving may interrupt it. Are you sure you want to leave?`,
      )

      return !shouldLeave
    },
  })

  return (
    <div className="h-full space-y-6 pb-4 max-md:bg-white md:space-y-4 md:pt-5">
      <div className="mx-auto max-w-6xl pt-3 md:w-full-[32px]">
        <RegistrationProgressBar
          {...match(step)
            .with('checkingAllowance', () => ({
              label: t`Checking allowance`,
              progress: 20,
            }))
            .with('submittingTokenApproval', () => ({
              label: t`Submitting token approval`,
              progress: 30,
            }))
            .with('waitingForTokenApproval', () => ({
              label: t`Waiting for token approval`,
              progress: 50,
            }))
            .with('submittingRenewal', 'submittingPlainRenewal', () => ({
              label: t`Submitting renewal`,
              progress: 70,
            }))
            .with('waitingForRenewal', () => ({
              label: t`Waiting for renewal`,
              progress: 90,
            }))
            .otherwise(() => ({
              label: t`Loading...`,
              progress: 0,
            }))}
        />
      </div>
      <div className="mx-auto w-full-[32px] max-w-6xl space-y-6.5">
        <RenewalDetails />
      </div>
    </div>
  )
}
