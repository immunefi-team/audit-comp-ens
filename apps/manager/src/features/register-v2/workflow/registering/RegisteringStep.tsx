import { useLingui } from '@lingui/react/macro'
import { useBlocker } from '@tanstack/react-router'
import { useEffect } from 'react'
import { match, P } from 'ts-pattern'
import { useCountdown } from '@/hooks/useCountdown'
import type { RegistrationStage } from '../../state/registration.stages'
import { RegisterV2Context } from '../../state/registrationUi.context'
import { useRegisteringStage } from '../../state/registrationUi.selectors'
import { CenteredWeaveLoader } from './components/CenteredWeaveLoader'
import { NotificationSettings } from './components/NotificationSettings'
import { PrimaryNameSetupNotice } from './components/PrimaryNameSetupNotice'
import { RegisteringHeader } from './components/RegisteringHeader'
import { RegistrationDetails } from './components/RegistrationDetails'
import { useRegisteringCompletion } from './hooks/useRegisteringCompletion'
import { getRegistrationStageMessages } from './lib/txStageMessages'
import { useRegistrationTxState } from './lib/txState'

const useUiRegistrationState = RegisterV2Context.createSelector((state) => {
  const transactionState = match(state.value)
    .with(
      { registering: { transaction: P.string } },
      (value) => value.registering.transaction,
    )
    .otherwise(() => undefined)

  return {
    transactionState,
    ethRecordSyncTxId: state.context.ethRecordSyncTxId,
    primaryNameTxId: state.context.primaryNameTxId,
  }
})

const useChildRegistrationState = RegisterV2Context.createTxSelector(
  (state) => ({
    resolverTxId: state?.context.resolverTxId,
    commitmentTxId: state?.context.commitmentTxId,
    approvalTxId: state?.context.approvalTxId,
    registrationTxId: state?.context.registrationTxId,
    registerReadyTimestamp: state?.context.registerReadyTimestamp ?? null,
    value: state?.value ?? 'idle',
  }),
)

const useMaxProgress = RegisterV2Context.createSelector(
  (state) => state.context.maxProgressReached ?? null,
)

const getDisplayedRegistrationStage = (
  transactionState: string | undefined,
  childStage: string,
): RegistrationStage =>
  match(transactionState)
    .with('postRegistrationDecision', () => 'postRegistrationSetup' as const)
    .with('syncingEthRecord', () => 'syncingEthRecord' as const)
    .with('waitingForEthRecordSync', () => 'waitingForEthRecordSync' as const)
    .with('settingPrimaryNameForward', () => 'settingPrimaryName' as const)
    .with('waitingForPrimaryNameForward', () => 'settingPrimaryName' as const)
    .with('settingPrimaryNameReverse', () => 'settingPrimaryName' as const)
    .with('waitingForPrimaryNameReverse', () => 'settingPrimaryName' as const)
    .with('success', () => 'success' as const)
    .otherwise(() => childStage as RegistrationStage)

/**
 * Derives the post-registration stage label/description/progress shown in the
 * header, composing the child registration machine state with the UI actor's
 * post-registration setup state (ETH record sync / primary name).
 */
const useRegisteringDisplay = () => {
  const { t, i18n } = useLingui()
  const { registrationActor, uiActor } = RegisterV2Context.use()
  const uiRegistrationState = useUiRegistrationState(uiActor)
  const childRegistrationState = useChildRegistrationState(registrationActor)
  const maxProgress = useMaxProgress(uiActor)

  const registrationStage = getDisplayedRegistrationStage(
    uiRegistrationState.transactionState,
    childRegistrationState.value,
  )
  const registeringTx = {
    ...childRegistrationState,
    ...uiRegistrationState,
    value: registrationStage,
  }
  const txState = useRegistrationTxState(registeringTx)
  const displayedStage = maxProgress?.stage ?? registeringTx.value
  const stageMessages = getRegistrationStageMessages(
    { ...registeringTx, value: displayedStage },
    txState,
  )

  const { remainingSeconds: cooldownSeconds, isActive: isCooldownActive } =
    useCountdown(registeringTx.registerReadyTimestamp)
  const cooldownSecondsDisplay = cooldownSeconds ?? 0
  const stageDescription = isCooldownActive
    ? t`Waiting for commitment cooldown — register unlocks in ${cooldownSecondsDisplay}s`
    : stageMessages.stageDescription
      ? i18n._(stageMessages.stageDescription)
      : undefined

  return {
    stageDescription,
    stageLabel: i18n._(stageMessages.stageLabel),
  }
}

export interface RegisteringStepProps {
  fillProgress: number
  fillDone: boolean
  isRegistrationComplete: boolean
  /** Parent latch — user dismissed notification settings and entered the weave flow. */
  sawWeaveFlow?: boolean
  showRegisteringCompletion?: boolean
  onWeaveFlowEntered?: () => void
  /** Fired after fill progress reaches 100% and the completion beat finishes. */
  onCompletionAnimationFinished?: () => void
}

export const RegisteringStep = ({
  fillProgress,
  fillDone,
  isRegistrationComplete,
  sawWeaveFlow = false,
  showRegisteringCompletion = false,
  onWeaveFlowEntered,
  onCompletionAnimationFinished,
}: RegisteringStepProps) => {
  const { t } = useLingui()
  const { uiActor, label } = RegisterV2Context.use()
  const uiStage = useRegisteringStage(uiActor)
  const { stageDescription, stageLabel } = useRegisteringDisplay()

  const notificationsCompleted = uiStage?.notifications === 'completed'
  // Keep the loader up through post-registration setup (primary name / ETH
  // record) so those steps read as part of the registration, with their stage
  // message shown under the fill.
  const showWeaveLoader =
    !isRegistrationComplete &&
    notificationsCompleted &&
    !!uiStage?.transaction &&
    uiStage.transaction !== 'success'

  // Single source of truth for entering the weave flow: the notifications step
  // reaching `completed` (a superset of the loader being shown, and the state
  // that `advanceNotificationsStep` transitions into).
  useEffect(() => {
    if (notificationsCompleted) {
      onWeaveFlowEntered?.()
    }
  }, [notificationsCompleted, onWeaveFlowEntered])

  const fullName = `${label}.eth`
  const { exitLoaderReady } = useRegisteringCompletion({
    isRegistrationComplete,
    sawWeaveFlow,
    fillDone,
    onCompletionAnimationFinished,
  })

  const holdForFill = isRegistrationComplete && sawWeaveFlow && !exitLoaderReady
  const inWeaveCompletion =
    sawWeaveFlow &&
    (showRegisteringCompletion || (isRegistrationComplete && !exitLoaderReady))
  const showCenteredLoader = showWeaveLoader || inWeaveCompletion
  const animateNameFill = inWeaveCompletion && isRegistrationComplete

  const advanceNotificationsStep = () => {
    uiActor.send({ type: 'notifications.step.next' })
  }

  useBlocker({
    shouldBlockFn: () => {
      if (isRegistrationComplete) {
        return false
      }
      if (uiStage?.transaction !== 'pendingRegistration') {
        return false
      }

      const shouldLeave = confirm(
        t`Your registration is in progress. Leaving may interrupt it. Are you sure you want to leave?`,
      )

      return !shouldLeave
    },
  })

  if (showCenteredLoader) {
    return (
      <CenteredWeaveLoader
        animate={animateNameFill}
        description={holdForFill ? undefined : stageDescription}
        name={fullName}
        progress={fillProgress}
      />
    )
  }

  return (
    <div className="h-full space-y-6 pb-4 max-md:bg-white md:space-y-4 md:pt-5">
      <div className="mx-auto max-w-6xl pt-3 md:w-full-[32px]">
        <RegisteringHeader
          fillProgress={fillProgress}
          isRegistrationComplete={isRegistrationComplete}
          stageLabel={stageLabel}
          uiStage={uiStage}
        />
        {isRegistrationComplete && (
          <div className="mt-4">
            <PrimaryNameSetupNotice />
          </div>
        )}
      </div>
      <div className="mx-auto w-full-[32px] max-w-6xl space-y-6.5">
        {match(uiStage)
          .with({ notifications: 'settings' }, () => (
            <NotificationSettings
              onConfirm={advanceNotificationsStep}
              onSkip={advanceNotificationsStep}
            />
          ))
          .with({ transaction: P.string }, () => <RegistrationDetails />)
          .otherwise(() => null)}
      </div>
    </div>
  )
}
