import type { MigrationSuccessDialogState } from './success/MigrationSuccessDialog.types'

export const shouldShowPlainMigrationSuccess = (params: {
  readonly context: 'migration' | 'mint-later'
  readonly state: MigrationSuccessDialogState
}): boolean =>
  params.context === 'migration' &&
  params.state.status === 'error' &&
  params.state.stage === 'configuration'
