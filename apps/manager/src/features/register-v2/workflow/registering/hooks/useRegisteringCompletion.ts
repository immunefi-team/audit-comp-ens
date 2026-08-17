import { useEffect, useRef, useState } from 'react'

/** Pause on a fully filled name before handing off to SuccessStep. */
const COMPLETION_BEAT_MS = 200

interface UseRegisteringCompletionParams {
  isRegistrationComplete: boolean
  /** Parent latch — user dismissed notification settings and entered the weave flow. */
  sawWeaveFlow: boolean
  fillDone: boolean
  /** Fired after fill progress reaches 100% and the completion beat finishes. */
  onCompletionAnimationFinished?: () => void
}

/**
 * Owns the end-of-registration beat lifecycle: resets when a run starts, waits
 * one {@link COMPLETION_BEAT_MS} beat once the fill is done and the weave flow
 * has been seen, then flags the loader ready to exit and fires the finished
 * callback exactly once.
 */
export const useRegisteringCompletion = ({
  isRegistrationComplete,
  sawWeaveFlow,
  fillDone,
  onCompletionAnimationFinished,
}: UseRegisteringCompletionParams) => {
  const [exitLoaderReady, setExitLoaderReady] = useState(false)
  const completionFinishedRef = useRef(false)
  const prevCompleteRef = useRef(isRegistrationComplete)

  useEffect(() => {
    if (isRegistrationComplete && !prevCompleteRef.current) {
      setExitLoaderReady(false)
      completionFinishedRef.current = false
    }
    if (!isRegistrationComplete) {
      setExitLoaderReady(false)
      completionFinishedRef.current = false
    }
    prevCompleteRef.current = isRegistrationComplete
  }, [isRegistrationComplete])

  useEffect(() => {
    if (!isRegistrationComplete || !sawWeaveFlow || !fillDone) return undefined

    const id = window.setTimeout(
      () => setExitLoaderReady(true),
      COMPLETION_BEAT_MS,
    )
    return () => window.clearTimeout(id)
  }, [fillDone, isRegistrationComplete, sawWeaveFlow])

  useEffect(() => {
    if (
      !exitLoaderReady ||
      !isRegistrationComplete ||
      !sawWeaveFlow ||
      completionFinishedRef.current
    ) {
      return
    }
    completionFinishedRef.current = true
    onCompletionAnimationFinished?.()
  }, [
    exitLoaderReady,
    isRegistrationComplete,
    onCompletionAnimationFinished,
    sawWeaveFlow,
  ])

  return { exitLoaderReady }
}
