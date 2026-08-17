/**
 * DEV-only: install the Anvil-tracking browser clock as early as possible.
 * Import this FIRST in the app entry (`main.tsx` / `client.tsx`):
 *
 *   import '@ens-apps/dev-time-travel/setup'
 *
 * No-op on the server and unless `import.meta.env.DEV && VITE_TIME_TRAVEL`;
 * the guard is statically false in production builds, so this collapses away.
 */
import { installChainClock } from '@ens-apps/utils/time-travel/installChainClock'
import { isTimeTravelEnabled } from './config'

if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  isTimeTravelEnabled()
) {
  installChainClock()
}
