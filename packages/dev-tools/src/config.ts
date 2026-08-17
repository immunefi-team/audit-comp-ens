import { isDQAEnabled } from '@ens-apps/dev-dqa-overlay'
import { isMigrationToolEnabled } from '@ens-apps/dev-migration-tool'
import { isTimeTravelEnabled } from '@ens-apps/dev-time-travel'

/** True when at least one dev/QA tool should surface the unified DevDrawer. */
export function isDevDrawerEnabled(): boolean {
  return isTimeTravelEnabled() || isMigrationToolEnabled() || isDQAEnabled()
}
