import { Plural, Trans } from '@lingui/react/macro'
import { CircleAlert } from 'lucide-react'
import { match } from 'ts-pattern'
import type { MigrationGasEstimateState } from '@/features/migration/hooks/useMigrationGasEstimate'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { WalletConfirmationStepsDialog } from './WalletConfirmationStepsDialog'

type GasEstimateMessageProps = {
  readonly gasEstimate: MigrationGasEstimateState
  readonly isWaitingForGasFunding: boolean
  readonly totalSelected: number
}

const GasEstimateMessage = ({
  gasEstimate,
  isWaitingForGasFunding,
  totalSelected,
}: GasEstimateMessageProps) => {
  if (totalSelected === 0) return null

  // The gas drip request only resolves once any sepETH top-up is confirmed
  // on-chain. Surface it so the owner knows why the button is briefly blocked.
  if (isWaitingForGasFunding) {
    return (
      <p>
        <Trans>Preparing your wallet with gas for the upgrade...</Trans>
      </p>
    )
  }

  return match(gasEstimate)
    .with({ status: 'loading' }, () => (
      <p>
        <Trans>Estimating migration gas...</Trans>
      </p>
    ))
    .with({ status: 'ready' }, (estimate) => (
      <p>
        <Trans>
          Estimated network fee:{' '}
          <strong className="font-semibold">
            ~{estimate.formattedEth} ETH
          </strong>
          . Expected:{' '}
          <WalletConfirmationStepsDialog
            steps={estimate.plan.stepDescriptors}
          />
          .
          <br />
          Final confirmations and fee are shown in your wallet.
        </Trans>
      </p>
    ))
    .with({ status: 'error' }, (estimate) => (
      <p>
        <Trans>Gas estimate unavailable</Trans>
        {estimate.message ? `: ${estimate.message}` : null}
      </p>
    ))
    .otherwise(() => null)
}

type UpgradeButtonLabelProps = {
  readonly isEstimatingGas: boolean
  readonly isStarting: boolean
  readonly isWaitingForGasFunding: boolean
  readonly totalSelected: number
}

const UpgradeButtonLabel = ({
  isEstimatingGas,
  isStarting,
  isWaitingForGasFunding,
  totalSelected,
}: UpgradeButtonLabelProps) => {
  if (isStarting) return <Trans>Starting...</Trans>
  if (isEstimatingGas) return <Trans>Estimating...</Trans>
  if (isWaitingForGasFunding) return <Trans>Preparing wallet...</Trans>
  return (
    <Plural
      one="Upgrade # name"
      other="Upgrade # names"
      value={totalSelected}
    />
  )
}

type SelectNamesStepFooterProps = {
  readonly gasEstimate: MigrationGasEstimateState
  readonly isEstimatingGas: boolean
  readonly isStarting: boolean
  readonly isUpgradeDisabled: boolean
  readonly isWaitingForGasFunding: boolean
  readonly onUpgrade: () => void
  readonly totalSelected: number
  readonly visibleCount: number
}

export const SelectNamesStepFooter = ({
  gasEstimate,
  isEstimatingGas,
  isStarting,
  isUpgradeDisabled,
  isWaitingForGasFunding,
  onUpgrade,
  totalSelected,
  visibleCount,
}: SelectNamesStepFooterProps) => {
  const nftCopyEnabled = isFeatureEnabled('COMMEMORATIVE_NFT_COPY')
  const atomicBatchCount =
    gasEstimate.status === 'ready'
      ? (gasEstimate.plan.atomicBatches?.length ?? 0)
      : 0

  return (
    <div className="sticky inset-x-0 bottom-0 z-20 flex min-h-36 w-full shrink-0 flex-col items-stretch justify-start gap-4 bg-ens-garnet-200 px-5 pt-4 pb-14 sm:min-h-28.75 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8 lg:px-37.5">
      <div className="flex max-w-107.5 flex-col gap-1 text-ens-garnet-900/75 text-xs leading-normal tracking-[-0.24px] sm:text-sm sm:leading-[1.2] sm:tracking-[-0.28px]">
        <GasEstimateMessage
          gasEstimate={gasEstimate}
          isWaitingForGasFunding={isWaitingForGasFunding}
          totalSelected={totalSelected}
        />
        {atomicBatchCount > 1 && (
          <p>
            <Trans>
              This upgrade is split into {atomicBatchCount} gas-safe atomic
              batches. Each batch needs a wallet confirmation.
            </Trans>
          </p>
        )}
      </div>
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <button
          className="h-11.5 w-full min-w-40 overflow-hidden rounded-sm bg-ens-garnet-900 px-4 py-2.5 font-semi-mono text-ens-garnet-50 text-sm uppercase tracking-[1.68px] shadow-[inset_0px_-3px_0px_0px_rgba(0,0,0,0.35)] disabled:opacity-50 sm:w-[320px]"
          disabled={isUpgradeDisabled}
          onClick={onUpgrade}
          type="button"
        >
          <UpgradeButtonLabel
            isEstimatingGas={isEstimatingGas}
            isStarting={isStarting}
            isWaitingForGasFunding={isWaitingForGasFunding}
            totalSelected={totalSelected}
          />
        </button>
        {nftCopyEnabled &&
          totalSelected > 0 &&
          totalSelected < visibleCount && (
            <p className="flex items-center gap-1 text-ens-garnet-500 text-sm leading-[1.2] tracking-[0.14px]">
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} />
              <Trans>Upgrade all names to receive NFT</Trans>
            </p>
          )}
      </div>
    </div>
  )
}
