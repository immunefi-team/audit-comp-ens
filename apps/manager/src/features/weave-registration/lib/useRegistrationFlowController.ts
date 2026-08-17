import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegistrationV2Context } from '@/features/register-v2/state/registrationUi.context'
import { useRegistrationStep } from '@/features/register-v2/state/registrationUi.selectors'
import { useRegistrationFillProgress } from './useRegistrationFillProgress'

function resetWeaveFlowState(
  sawWeaveFlowRef: { current: boolean },
  setSawWeaveFlow: (value: boolean) => void,
  setCompletionAnimationDone: (value: boolean) => void,
) {
  sawWeaveFlowRef.current = false
  setSawWeaveFlow(false)
  setCompletionAnimationDone(false)
}

/**
 * Single controller for the registration weave-flow animation lifecycle:
 * tracks whether the user has entered the weave flow, drives fill progress
 * (surviving RegisteringStep remounts), resets on step changes, and exposes
 * whether the success-completion animation should still play.
 */
export function useRegistrationFlowController() {
  const { uiActor } = useRegistrationV2Context()
  const step = useRegistrationStep(uiActor)
  const sawWeaveFlowRef = useRef(false)
  const [sawWeaveFlow, setSawWeaveFlow] = useState(false)
  const [completionAnimationDone, setCompletionAnimationDone] = useState(false)
  const [fillGeneration, setFillGeneration] = useState(0)
  const prevStepRef = useRef(step)

  const bumpFillGeneration = useCallback(() => {
    setFillGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    const prevStep = prevStepRef.current
    if (step === 'registering' && prevStep !== 'registering') {
      resetWeaveFlowState(
        sawWeaveFlowRef,
        setSawWeaveFlow,
        setCompletionAnimationDone,
      )
      bumpFillGeneration()
    }
    if (step === 'pricing' && prevStep !== 'pricing') {
      resetWeaveFlowState(
        sawWeaveFlowRef,
        setSawWeaveFlow,
        setCompletionAnimationDone,
      )
      bumpFillGeneration()
    }
    prevStepRef.current = step
  }, [step, bumpFillGeneration])

  const markWeaveFlow = useCallback(() => {
    if (sawWeaveFlowRef.current) return
    sawWeaveFlowRef.current = true
    setSawWeaveFlow(true)
  }, [])

  const markCompletionAnimationDone = useCallback(() => {
    setCompletionAnimationDone(true)
  }, [])

  const {
    progress: fillProgress,
    fillDone,
    isRegistrationComplete,
  } = useRegistrationFillProgress(sawWeaveFlow, fillGeneration)

  const showRegisteringCompletion =
    step === 'success' && sawWeaveFlowRef.current && !completionAnimationDone

  return {
    step,
    sawWeaveFlow,
    fillProgress,
    fillDone,
    isRegistrationComplete,
    showRegisteringCompletion,
    markWeaveFlow,
    markCompletionAnimationDone,
  }
}
