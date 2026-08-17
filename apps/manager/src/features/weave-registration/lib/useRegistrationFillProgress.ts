import { RegisterV2Context } from '@/features/register-v2/state/registrationUi.context'
import {
  useRegisteringStage,
  useRegistrationStep,
} from '@/features/register-v2/state/registrationUi.selectors'
import { useCountdown } from '@/hooks/useCountdown'
import { useForwardProgress } from './useForwardProgress'

const useRegisteringTx = RegisterV2Context.createTxSelector((state) => ({
  value: state?.value ?? 'idle',
  registerReadyTimestamp: state?.context.registerReadyTimestamp ?? null,
}))

const useMaxProgress = RegisterV2Context.createSelector(
  (state) => state.context.maxProgressReached ?? null,
)

/**
 * Display fill progress for the registration name. Lives at route level so the
 * rAF driver survives RegisteringStep remounts during the success transition.
 *
 * The completion sweep (88→100% in ~0.5s) only runs once the user has entered
 * the weave flow (`sawWeaveFlow`), so we never finish the fill off-screen.
 */
export function useRegistrationFillProgress(
  sawWeaveFlow: boolean,
  resetGeneration: number,
) {
  const { registrationActor, uiActor, label } = RegisterV2Context.use()
  const registeringTx = useRegisteringTx(registrationActor)
  const uiStage = useRegisteringStage(uiActor)
  const machineStep = useRegistrationStep(uiActor)
  const maxProgress = useMaxProgress(uiActor)

  const displayedProgress = maxProgress?.progress ?? 0
  const fullName = `${label}.eth`

  const { remainingSeconds: cooldownSeconds, isActive: isCooldownActive } =
    useCountdown(registeringTx.registerReadyTimestamp)

  // Complete only when the parent UI machine is done: the child registration
  // machine reports success before post-registration setup (primary name /
  // ETH record) has run, so gating on it would show "complete" too early.
  const isRegistrationComplete =
    uiStage?.transaction === 'success' || machineStep === 'success'

  const runCompletionSweep = isRegistrationComplete && sawWeaveFlow

  return {
    fullName,
    isRegistrationComplete,
    ...useForwardProgress(
      displayedProgress,
      runCompletionSweep,
      fullName.length,
      isCooldownActive ? cooldownSeconds : null,
      resetGeneration,
    ),
  }
}
