import { Plural, Trans } from '@lingui/react/macro'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { MSymbol } from '@/components/ui/material-symbol'
import { GrainOverlay } from '@/features/migration/components/GrainOverlay'
import { cn } from '@/lib/utils'
import { shouldShowPlainMigrationSuccess } from './MigrationSuccessDialog.helpers'
import { CommemorativeNftCard } from './success/CommemorativeNftCard'
import type { MigrationSuccessDialogState } from './success/MigrationSuccessDialog.types'

type MigrationSuccessDialogProps = {
  readonly context: 'migration' | 'mint-later'
  readonly open: boolean
  readonly state: MigrationSuccessDialogState
  readonly migratedNameCount: number
  readonly canMint: boolean
  readonly onClose: () => void
  readonly onMint: () => void
  readonly onRetry: () => void
  readonly onRevealComplete: () => void
  readonly onViewProfile: () => void
}

const DialogHeading = ({
  context,
}: {
  readonly context: MigrationSuccessDialogProps['context']
}) => (
  <div className="flex w-full shrink-0 flex-col items-start gap-3 pt-3 pr-12">
    <DialogTitle className="font-normal text-[34px] text-ens-garnet-900 leading-[1.04] tracking-[-0.68px]">
      {context === 'migration' ? (
        <Trans>Your name(s) have been upgraded!</Trans>
      ) : (
        <Trans>Your ENSv2 moment is waiting</Trans>
      )}
    </DialogTitle>
    <DialogDescription className="font-normal text-[15px] text-ens-garnet-500 leading-[1.3] tracking-[0.08px]">
      <Trans>
        You&apos;re among the first on ENSv2. This NFT marks the moment.
      </Trans>
    </DialogDescription>
  </div>
)

const PrimaryButton = ({
  children,
  disabled,
  onClick,
}: {
  readonly children: React.ReactNode
  readonly disabled?: boolean
  readonly onClick: () => void
}) => (
  <button
    className="group/button flex min-h-12 w-full items-center justify-center rounded-xs bg-ens-garnet-900 px-5 py-3 font-semi-mono text-ens-garnet-50 text-sm uppercase tracking-[0.1em] shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-ens-garnet-800 focus-visible:outline-2 focus-visible:outline-ens-garnet-900 focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none motion-reduce:transition-none"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
)

const PlainMigrationSuccessContent = ({
  migratedNameCount,
  onOpenDashboard,
}: {
  readonly migratedNameCount: number
  readonly onOpenDashboard: () => void
}) => (
  <div className="flex w-full flex-col items-center text-center">
    <DialogTitle className="max-w-sm text-balance font-normal text-[30px] text-ens-garnet-900 leading-[1.05] tracking-[-0.03em] sm:text-[34px]">
      <Plural
        one="Your name has been upgraded!"
        other="Your names have been upgraded!"
        value={migratedNameCount}
      />
    </DialogTitle>
    <DialogDescription className="mt-3 max-w-80 text-pretty font-normal text-[15px] text-ens-garnet-800/75 leading-[1.45]">
      <Trans>You can manage your upgraded names from the dashboard.</Trans>
    </DialogDescription>

    <div className="mt-8 w-full">
      <PrimaryButton onClick={onOpenDashboard}>
        <span className="flex items-center gap-2">
          <Trans>Open Dashboard</Trans>
          <MSymbol
            aria-hidden
            className="text-[20px] transition-transform duration-150 ease-out group-hover/button:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            symbol="arrow_forward"
          />
        </span>
      </PrimaryButton>
    </div>
  </div>
)

const SecondaryButton = ({
  children,
  onClick,
}: {
  readonly children: React.ReactNode
  readonly onClick: () => void
}) => (
  <button
    className="min-h-10 px-4 font-semi-mono text-ens-garnet-500 text-xs uppercase tracking-[0.1em] transition-opacity hover:opacity-65"
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
)

const StatusContent = ({
  state,
  canMint,
  onClose,
  onMint,
  onRetry,
  onRevealComplete,
  onViewProfile,
}: Omit<
  MigrationSuccessDialogProps,
  'context' | 'migratedNameCount' | 'open'
>) => {
  if (state.status === 'ineligible') {
    return (
      <div className="flex min-h-86 w-full flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-white/60 text-ens-garnet-500">
          <MSymbol className="text-[28px]" symbol="info" />
        </div>
        <div className="max-w-80 space-y-2">
          <p className="font-sans text-ens-garnet-900 text-xl">
            <Trans>This address is not in the commemorative snapshot.</Trans>
          </p>
          <p className="font-sans text-ens-garnet-500 text-sm leading-relaxed">
            <Trans>
              Eligibility was frozen on June 1 and is limited to one NFT per
              address.
            </Trans>
          </p>
        </div>
        <a
          className="font-semi-mono text-ens-garnet-500 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
          href="/migration/nft"
        >
          <Trans>Learn about eligibility</Trans>
        </a>
        <PrimaryButton onClick={onViewProfile}>
          <Trans>Continue to profile</Trans>
        </PrimaryButton>
      </div>
    )
  }

  if (state.status === 'error' && !state.card) {
    return (
      <div className="flex min-h-86 w-full flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-white/60 text-ens-garnet-500">
          <MSymbol className="text-[28px]" symbol="warning" />
        </div>
        <p className="max-w-80 font-sans text-ens-garnet-700 text-sm leading-relaxed">
          {state.message}
        </p>
        {state.stage === 'eligibility' ? (
          <PrimaryButton onClick={onRetry}>
            <Trans>Try again</Trans>
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onViewProfile}>
            <Trans>Continue to profile</Trans>
          </PrimaryButton>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <CommemorativeNftCard onRevealComplete={onRevealComplete} state={state} />

      <div className="flex w-full flex-col items-center gap-1">
        {state.status === 'loadingEligibility' ||
        state.status === 'revealing' ? (
          <p
            aria-live="polite"
            className="py-3 font-semi-mono text-ens-garnet-500 text-xs uppercase tracking-[0.12em]"
          >
            <Trans>Preparing your commemorative NFT…</Trans>
          </p>
        ) : null}

        {state.status === 'readyToMint' ? (
          <>
            <PrimaryButton disabled={!canMint} onClick={onMint}>
              {canMint ? <Trans>Mint NFT</Trans> : <Trans>Preview only</Trans>}
            </PrimaryButton>
            <SecondaryButton onClick={onClose}>
              <Trans>Maybe later</Trans>
            </SecondaryButton>
          </>
        ) : null}

        {state.status === 'minting' ? (
          <>
            <PrimaryButton disabled onClick={onMint}>
              <span className="flex items-center gap-2">
                <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                <Trans>Minting…</Trans>
              </span>
            </PrimaryButton>
            <p
              aria-live="polite"
              className="pt-2 font-sans text-ens-garnet-500 text-xs"
            >
              <Trans>
                Keep this window open while the transaction confirms.
              </Trans>
            </p>
          </>
        ) : null}

        {state.status === 'minted' ? (
          <>
            <p
              aria-live="polite"
              className="pb-2 font-sans text-ens-garnet-700 text-sm"
            >
              <Trans>Your commemorative NFT is now yours.</Trans>
            </p>
            <PrimaryButton onClick={onViewProfile}>
              <span className="flex items-center gap-2">
                <Trans>View profile</Trans>
                <MSymbol className="text-[20px]" symbol="arrow_forward" />
              </span>
            </PrimaryButton>
          </>
        ) : null}

        {state.status === 'error' && state.card ? (
          <>
            <p
              aria-live="polite"
              className="pb-2 text-center font-sans text-ens-garnet-700 text-sm"
            >
              {state.message}
            </p>
            <PrimaryButton onClick={onRetry}>
              <Trans>Try again</Trans>
            </PrimaryButton>
            <SecondaryButton onClick={onClose}>
              <Trans>Maybe later</Trans>
            </SecondaryButton>
          </>
        ) : null}
      </div>
    </div>
  )
}

export const MigrationSuccessDialog = ({
  context,
  open,
  state,
  migratedNameCount,
  canMint,
  onClose,
  onMint,
  onRetry,
  onRevealComplete,
  onViewProfile,
}: MigrationSuccessDialogProps) => {
  const showPlainMigrationSuccess = shouldShowPlainMigrationSuccess({
    context,
    state,
  })

  return (
    <Dialog
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
      open={open}
    >
      <DialogContent
        className="h-auto max-h-[calc(100dvh-1rem)] w-[min(456px,calc(100vw-1rem))] max-w-none gap-0 overflow-y-auto overflow-x-hidden rounded-sm border-0 bg-linear-to-b from-ens-garnet-100 to-ens-garnet-200 p-0 shadow-[0_24px_90px_rgba(70,0,30,0.24)] motion-reduce:duration-0 sm:max-w-none"
        overlayClassName="bg-ens-garnet-900/50"
        showCloseButton={false}
      >
        <GrainOverlay className="opacity-40" />
        <button
          className="absolute top-4 right-4 z-20 flex size-10 items-center justify-center rounded-full border border-ens-garnet-900/10 bg-white/20 text-ens-garnet-900 transition-colors duration-150 ease-out hover:bg-white/55 focus-visible:outline-2 focus-visible:outline-ens-garnet-900 focus-visible:outline-offset-2 motion-reduce:transition-none"
          onClick={onClose}
          type="button"
        >
          <MSymbol aria-hidden className="text-[21px]" symbol="close" />
          <span className="sr-only">
            <Trans>Close</Trans>
          </span>
        </button>

        <div
          className={cn(
            'relative z-10 flex w-full flex-col items-center px-5 min-[420px]:px-8',
            showPlainMigrationSuccess ? 'pt-16 pb-9 sm:pb-10' : 'gap-4 py-7',
          )}
        >
          {showPlainMigrationSuccess ? (
            <PlainMigrationSuccessContent
              migratedNameCount={migratedNameCount}
              onOpenDashboard={onClose}
            />
          ) : (
            <>
              <DialogHeading context={context} />
              <StatusContent
                canMint={canMint}
                onClose={onClose}
                onMint={onMint}
                onRetry={onRetry}
                onRevealComplete={onRevealComplete}
                onViewProfile={onViewProfile}
                state={state}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
