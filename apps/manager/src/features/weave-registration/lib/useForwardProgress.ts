import { useRafProgress } from '@ens-apps/weave-loader/hooks/useRafProgress'
import {
  advanceForwardProgress,
  type ForwardProgressInputs,
  isForwardProgressComplete,
  snapForwardProgress,
} from './forwardProgressMath'

export interface ForwardProgress {
  progress: number
  fillDone: boolean
}

type ForwardProgressContext = ForwardProgressInputs & {
  resetGeneration: number
}

/**
 * Smooth display progress for the registration name fill.
 *
 * Pacing rules live in `forwardProgressMath.ts`; the rAF driver is
 * `@ens-apps/weave-loader`'s `useRafProgress`.
 */
export function useForwardProgress(
  stageProgress: number,
  isComplete: boolean,
  nameLength: number,
  cooldownRemainingSeconds: number | null = null,
  resetGeneration = 0,
): ForwardProgress {
  const progress = useRafProgress<ForwardProgressContext>({
    advance: (inputs, current, dt) =>
      advanceForwardProgress(inputs, current, dt),
    snap: snapForwardProgress,
    context: {
      stageProgress,
      isComplete,
      nameLength,
      cooldownRemainingSeconds,
      resetGeneration,
    },
    resetGeneration,
  })

  return {
    progress,
    fillDone: isForwardProgressComplete(isComplete, progress),
  }
}
