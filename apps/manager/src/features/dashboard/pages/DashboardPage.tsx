import { Trans } from '@lingui/react/macro'
import { useFeatureFlagEnabled } from '@posthog/react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { MSymbol } from '@/components/ui/material-symbol'
import { ChoosePrimaryNameDialog } from '@/features/dashboard/components/ChoosePrimaryNameDialog'
import { DashboardGraceBanner } from '@/features/dashboard/components/DashboardGraceBanner'
import { EducationCarousel } from '@/features/dashboard/components/EducationCarousel'
import { FaqSection } from '@/features/dashboard/components/FaqSection'
import { NamesTable } from '@/features/dashboard/components/NamesTable'
import { PrimaryNameCard } from '@/features/dashboard/components/PrimaryNameCard'
import { MigrationModal } from '@/features/migration/components/MigrationModal'
import { MigrationProgressBanner } from '@/features/migration/components/MigrationProgressBanner'
import { CommemorativeNftDashboardPrompt } from '@/features/migration/components/success/CommemorativeNftDashboardPrompt'
import { UpgradeBanner } from '@/features/migration/components/UpgradeBanner'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import {
  isMigrationNftEnabled,
  POSTHOG_FEATURE_FLAGS,
} from '@/lib/posthog/feature-flags'
import { useSmartAccountContext } from '@/lib/smart-account'

const stagger = (index: number, shouldReduceMotion: boolean | null) =>
  shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.25,
          ease: [0.25, 0.46, 0.45, 0.94] as const,
          delay: index * 0.06,
        },
      }

export const DashboardPage = () => {
  const { ownerAddress } = useSmartAccountContext()
  const shouldReduceMotion = useReducedMotion()
  const migrationEnabled = useFeatureFlagEnabled(
    POSTHOG_FEATURE_FLAGS.MIGRATION,
    false,
  )
  const migrationNftEnabled = useFeatureFlagEnabled(
    POSTHOG_FEATURE_FLAGS.MIGRATION_NFT,
    false,
  )
  const commemorativeNftEnabled = isMigrationNftEnabled({
    migrationEnabled,
    migrationNftEnabled,
  })

  // Non-suspense so a resolver error degrades to `undefined` (UI falls back to
  // `reverseName ?? null`) instead of throwing into the route and crashing it.
  const { data: reverseName } = useQuery({
    ...profileReverseNameQuery(ownerAddress ?? undefined),
    enabled: !!ownerAddress,
  })

  const { data: reverseRecords } = useQuery({
    ...profileRecordsQuery(reverseName ?? ''),
    enabled: !!reverseName,
  })

  const themeColor = reverseRecords?.texts.find(
    (text) => text.key === 'theme',
  )?.value

  const defaultName = reverseName ?? null
  const avatarUrl = reverseName ? buildNameAvatarUrl(reverseName) : null
  const hasProfile = Boolean(defaultName)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 pt-0 pb-6 md:w-[calc(100%-4rem)] md:flex-row md:gap-8 md:pb-10">
      {migrationEnabled && <MigrationModal />}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {migrationEnabled && (
          <motion.div className="w-full" {...stagger(0, shouldReduceMotion)}>
            <UpgradeBanner />
          </motion.div>
        )}
        {commemorativeNftEnabled ? <CommemorativeNftDashboardPrompt /> : null}
        <motion.div
          className="w-full px-4 empty:hidden md:px-0"
          {...stagger(1, shouldReduceMotion)}
        >
          <DashboardGraceBanner primaryLabel={defaultName} />
        </motion.div>
        {hasProfile ? (
          <motion.div {...stagger(2, shouldReduceMotion)}>
            <PrimaryNameCard
              avatarUrl={avatarUrl}
              primaryName={defaultName}
              themeColor={themeColor}
            />
          </motion.div>
        ) : (
          <motion.div
            className="flex flex-col items-start gap-3 border-[0.25px] border-border bg-white px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:rounded-xl md:px-6 md:py-8"
            {...stagger(2, shouldReduceMotion)}
          >
            <span className="font-sans text-[16px] text-foreground">
              <Trans>You haven't set a primary name yet.</Trans>
            </span>
            <ChoosePrimaryNameDialog>
              <button
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-ens-blue/20 bg-ens-blue/5 px-3 py-1.5 text-ens-blue transition-colors hover:bg-ens-blue/10"
                type="button"
              >
                <MSymbol
                  className="ms-opsz-20 ms-wght-500 text-sm"
                  symbol="badge"
                />
                <span className="whitespace-nowrap font-medium font-sans text-xs">
                  <Trans>Set primary name</Trans>
                </span>
              </button>
            </ChoosePrimaryNameDialog>
          </motion.div>
        )}
        <motion.div
          className="border-[0.25px] border-border bg-white px-4 py-6 md:rounded-xl md:px-6 md:py-8"
          {...stagger(3, shouldReduceMotion)}
        >
          <NamesTable
            migrationEnabled={migrationEnabled}
            primaryLabel={defaultName}
          />
        </motion.div>
        {migrationEnabled && <MigrationProgressBanner />}
        <motion.div
          className="border-[0.25px] border-border bg-white px-4 py-6 md:rounded-xl md:px-6 md:py-8"
          {...stagger(4, shouldReduceMotion)}
        >
          <EducationCarousel />
        </motion.div>
        <motion.div {...stagger(5, shouldReduceMotion)}>
          <FaqSection />
        </motion.div>
      </div>
    </div>
  )
}
