import { Trans } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { GrainOverlay } from '@/features/migration/components/GrainOverlay'
import { useEligibleV1Names } from '@/features/migration/hooks/useEligibleV1Names'
import { useMigratedNamesCount } from '@/features/migration/hooks/useMigratedNamesCount'
import { useSmartAccountContext } from '@/lib/smart-account'
import { isFeatureEnabled } from '@/utils/feature-flags'

export const MigrationProgressBanner = () => {
  const nftCopyEnabled = isFeatureEnabled('COMMEMORATIVE_NFT_COPY')
  const navigate = useNavigate()
  const { isConnected } = useSmartAccountContext()
  const { eligible: eligibleV1Names, isPending: isV1Pending } =
    useEligibleV1Names()
  const { data: migratedCount, isPending: isCountPending } =
    useMigratedNamesCount()

  if (!isConnected) return null
  if (isV1Pending || isCountPending) return null

  const migrated = migratedCount ?? 0
  const remaining = eligibleV1Names.length
  const total = migrated + remaining

  if (migrated < 1 || remaining < 1) return null

  const progressPercent = Math.min(100, Math.max(0, (migrated / total) * 100))

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-ens-garnet-100 to-ens-garnet-200 px-4 py-6 md:rounded-lg md:px-6 md:py-8">
      <GrainOverlay />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-semi-mono text-[10px] text-ens-garnet-500 uppercase leading-[1.2] tracking-[0.2px]">
            <Trans>
              {migrated} out of {total} names upgraded
            </Trans>
          </p>
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progressPercent)}
            className="relative h-1 w-full overflow-hidden rounded-full bg-ens-garnet-500"
            role="progressbar"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-ens-garnet-900 transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="text-[32px] text-ens-garnet-900 leading-[1.1] tracking-[-0.64px]">
              <Trans>You're almost there!</Trans>
            </h2>
            <p className="text-base text-ens-garnet-500 leading-[1.2] tracking-[0.16px]">
              {nftCopyEnabled ? (
                <Trans>
                  Complete upgrade and receive a collectible marking your place
                  in ENS history.
                </Trans>
              ) : (
                <Trans>Complete upgrade to unlock your new ENS profile.</Trans>
              )}
            </p>
          </div>
          <button
            className="w-full shrink-0 rounded-sm bg-ens-garnet-900 px-4 py-3.5 font-semi-mono text-ens-garnet-50 text-sm uppercase tracking-[0.24px] shadow-[inset_0px_-3px_0px_0px_rgba(0,0,0,0.35)] md:w-[338px]"
            onClick={() => navigate({ to: '/migration' })}
            type="button"
          >
            <Trans>Complete Upgrade</Trans>
          </button>
        </div>
      </div>
    </div>
  )
}
