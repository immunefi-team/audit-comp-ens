export const POSTHOG_FEATURE_FLAGS = {
  MIGRATION: 'migration',
  MIGRATION_NFT: 'migration-nft',
} as const

export const isMigrationNftEnabled = (params: {
  readonly migrationEnabled: boolean | null | undefined
  readonly migrationNftEnabled: boolean | null | undefined
}): boolean =>
  params.migrationEnabled === true && params.migrationNftEnabled === true
