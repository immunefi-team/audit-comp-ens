import { Trans } from '@lingui/react/macro'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { GrainOverlay } from '@/features/migration/components/GrainOverlay'
import { UpgradeNamesButton } from '@/features/migration/components/UpgradeNamesButton'
import { MigrationValuePropsCarousel } from '@/features/migration/components/value-props/MigrationValuePropsCarousel'
import { useEligibleV1Names } from '@/features/migration/hooks/useEligibleV1Names'
import { useMigratedNamesCount } from '@/features/migration/hooks/useMigratedNamesCount'
import { useOpenModalOnFirstVisit } from '@/features/migration/hooks/useOpenModalOnFirstVisit'
import { useSmartAccountContext } from '@/lib/smart-account'
import { isFeatureEnabled } from '@/utils/feature-flags'

export const MigrationModal = () => {
  const nftCopyEnabled = isFeatureEnabled('COMMEMORATIVE_NFT_COPY')
  const { isConnected } = useSmartAccountContext()
  const { eligible: eligibleV1Names, isPending: isEligibleV1NamesPending } =
    useEligibleV1Names({ fallbackToClassified: false })
  const { data: migratedCount, isPending: isMigratedCountPending } =
    useMigratedNamesCount()
  const eligibleNameCount = eligibleV1Names.length
  const hasUnstartedMigration =
    !isEligibleV1NamesPending &&
    !isMigratedCountPending &&
    eligibleNameCount > 0 &&
    (migratedCount ?? 0) === 0
  const { open, dismiss } = useOpenModalOnFirstVisit(
    isConnected,
    hasUnstartedMigration,
  )

  return (
    <Dialog
      onOpenChange={(value) => {
        if (!value) dismiss()
      }}
      open={open}
    >
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden border-0 bg-linear-to-b from-ens-garnet-100 to-ens-garnet-200 p-0 sm:max-h-none sm:max-w-[726px] sm:overflow-hidden"
        showCloseButton={false}
      >
        <GrainOverlay />

        <button
          className="absolute top-5 right-5 z-20 cursor-pointer text-ens-garnet-800 opacity-70 transition-opacity hover:opacity-100"
          onClick={dismiss}
          type="button"
        >
          <X className="size-5" />
          <span className="sr-only">
            <Trans>Close</Trans>
          </span>
        </button>

        <div className="relative z-10 mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 px-5 pt-5 pb-5 sm:gap-4 sm:pt-7 sm:pb-7">
          <DialogTitle className="w-full pt-2 font-normal text-[28px] text-ens-garnet-900 leading-[1.05] tracking-[-0.56px] sm:pt-4 sm:text-[32px] sm:leading-[1.1] sm:tracking-[-0.64px]">
            <Trans>Welcome to the new ENS app!</Trans>
          </DialogTitle>
          <DialogDescription className="w-full text-[15px] text-ens-garnet-500 leading-[1.15] tracking-[-0.2px] sm:text-base sm:leading-[1.2] sm:tracking-[-0.24px]">
            {nftCopyEnabled ? (
              <Trans>
                Upgrade your name(s) in just a couple steps to unlock your new
                ENS profile and claim your commemorative NFT.
              </Trans>
            ) : (
              <Trans>
                Upgrade your name(s) in just a couple steps to unlock your new
                ENS profile.
              </Trans>
            )}
          </DialogDescription>

          <MigrationValuePropsCarousel />

          {/* biome-ignore lint/a11y/useKeyWithClickEvents: dismiss wrapper, button inside handles keyboard */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dismiss wrapper, button inside handles keyboard */}
          <div
            className="flex w-full max-w-[313px] flex-col items-start gap-2"
            onClick={dismiss}
          >
            <UpgradeNamesButton className="w-full tracking-[1.68px]" />
            {eligibleNameCount > 0 && (
              <p className="w-full font-semi-mono text-[10px] text-ens-garnet-900 uppercase leading-[1.2] tracking-[0.1px]">
                <Trans>
                  You have{' '}
                  <span className="font-medium">{eligibleNameCount}</span> names
                  that are eligible for upgrade
                </Trans>
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
