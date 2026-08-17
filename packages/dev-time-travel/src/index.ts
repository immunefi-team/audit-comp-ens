/**
 * `@ens-apps/dev-time-travel` — DEV-only manual time-travel tooling.
 *
 * Apps:
 *  - `import '@ens-apps/dev-time-travel/setup'` first in their entry to install
 *    the Anvil-tracking browser clock.
 *  - mount `<TimeTravelPanel />` (gated by `isTimeTravelEnabled()`) in the root.
 *  - use `TIME_TRAVEL_RPC` / `isTimeTravelEnabled` in dev-only feature code.
 */

export { anvilSetupOwner } from './anvilSetupOwner'
export { isTimeTravelEnabled, TIME_TRAVEL_RPC } from './config'
export { TimeTravelPanel, TimeTravelPanelContent } from './TimeTravelPanel'
