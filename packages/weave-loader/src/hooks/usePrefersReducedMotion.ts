import { useMediaQuery } from '@ens-apps/utils/useMediaQuery'

/**
 * `true` when the user has requested reduced motion at the OS/browser level.
 * Use to disable non-essential animation (shimmer sweeps, rAF loops, fill
 * transitions) in user-facing flows.
 */
export const usePrefersReducedMotion = (): boolean =>
  useMediaQuery('(prefers-reduced-motion: reduce)')
