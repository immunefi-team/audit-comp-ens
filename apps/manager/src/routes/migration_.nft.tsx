import { createFileRoute, redirect } from '@tanstack/react-router'
import { MigrationNftInfoPage } from '@/features/migration/pages/MigrationNftInfoPage'
import {
  isMigrationNftEnabled,
  POSTHOG_FEATURE_FLAGS,
} from '@/lib/posthog/feature-flags'
import { getFeatureFlag } from '@/lib/posthog/get-feature-flag'
import { seo } from '@/utils/seo'

export const Route = createFileRoute('/migration_/nft')({
  beforeLoad: async () => {
    const [migrationAccess, migrationNftAccess] = await Promise.all([
      getFeatureFlag({
        data: { flag: POSTHOG_FEATURE_FLAGS.MIGRATION },
      }),
      getFeatureFlag({
        data: { flag: POSTHOG_FEATURE_FLAGS.MIGRATION_NFT },
      }),
    ])

    if (
      !isMigrationNftEnabled({
        migrationEnabled: migrationAccess,
        migrationNftEnabled: migrationNftAccess,
      })
    ) {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: MigrationNftInfoPage,
  head: () => ({
    meta: seo({
      title: 'ENSv2 Commemorative NFT',
      description:
        'Learn how ENSv2 commemorative NFT eligibility and minting work.',
    }),
  }),
})
