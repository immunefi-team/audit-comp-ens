import { match, P } from 'ts-pattern'
import { createMigrationUiSelector } from './migrationUi.context'

export const useMigrationStep = createMigrationUiSelector((state) =>
  match(state.value)
    .with({ migrate: P.any }, () => 'migrate' as const)
    .with(P.string, (step) => step)
    .exhaustive(),
)

export const useMigrateSubstep = createMigrationUiSelector((state) =>
  match(state.value)
    .with({ migrate: P.string }, ({ migrate }) => migrate)
    .otherwise(() => undefined),
)

export const useMigrationProgress = createMigrationUiSelector(
  (state) => state.context.progress,
)

export const useMigrationStepDescriptors = createMigrationUiSelector(
  (state) => state.context.stepDescriptors,
)

export const useMigrationMigratedNames = createMigrationUiSelector(
  (state) => state.context.migratedNames,
)

export const useMigrationLastError = createMigrationUiSelector(
  (state) => state.context.lastError,
)

export const useMigrationSelectedNames = createMigrationUiSelector(
  (state) => state.context.selectedNames,
)
