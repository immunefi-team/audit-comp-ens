import { Plural, Trans } from '@lingui/react/macro'
import { match } from 'ts-pattern'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { MigrationStepDescriptor } from '@/features/migration/service/buildStepDescriptors'

type StepCopyProps = {
  readonly step: MigrationStepDescriptor
}

const StepCopy = ({ step }: StepCopyProps) =>
  match(step)
    .with({ type: 'deploy-hca' }, () => (
      <>
        <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
          <Trans>Create migration account</Trans>
        </h3>
        <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
          <Trans>
            Create the secure account that performs the name upgrade.
          </Trans>
        </p>
      </>
    ))
    .with(
      { type: 'approval', approvalId: 'base-registrar:hca-token' },
      ({ name }) => (
        <>
          <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
            {name ? (
              <Trans>Approve {name}</Trans>
            ) : (
              <Trans>Approve registration</Trans>
            )}
          </h3>
          <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
            <Trans>
              Allow the migration account to move this registration.
            </Trans>
          </p>
        </>
      ),
    )
    .with(
      { type: 'approval', approvalId: 'base-registrar:hca' },
      ({ count }) => (
        <>
          <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
            {count ? (
              <Plural
                one="Approve # registration"
                other="Approve # registrations"
                value={count}
              />
            ) : (
              <Trans>Approve registrations</Trans>
            )}
          </h3>
          <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
            <Trans>One approval covers the selected .eth registrations.</Trans>
          </p>
        </>
      ),
    )
    .with({ type: 'approval', approvalId: 'name-wrapper:hca' }, () => (
      <>
        <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
          <Trans>Approve wrapped names</Trans>
        </h3>
        <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
          <Trans>Allow the migration account to move your wrapped names.</Trans>
        </p>
      </>
    ))
    .with({ type: 'approval', approvalId: 'eth-registry:hca' }, () => (
      <>
        <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
          <Trans>Approve manager restoration</Trans>
        </h3>
        <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
          <Trans>Restore the existing managers for your names.</Trans>
        </p>
      </>
    ))
    .with({ type: 'atomic-batch' }, ({ count, index, total }) => (
      <>
        <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
          {total > 1 ? (
            <Trans>
              Upgrade batch {index + 1} of {total}
            </Trans>
          ) : (
            <Plural
              one="Upgrade # name"
              other="Upgrade # names"
              value={count}
            />
          )}
        </h3>
        <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
          <Trans>Migrate the selected names and restore their records.</Trans>
        </p>
      </>
    ))
    .with({ type: 'cleanup' }, () => (
      <>
        <h3 className="text-pretty font-medium text-base text-ens-garnet-900 leading-tight">
          <Trans>Revoke temporary HCA access</Trans>
        </h3>
        <p className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
          <Trans>Remove the temporary permission after the upgrade.</Trans>
        </p>
      </>
    ))
    .exhaustive()

const stepKey = (step: MigrationStepDescriptor): string =>
  match(step)
    .with({ type: 'deploy-hca' }, () => 'deploy-hca')
    .with(
      { type: 'approval', approvalId: 'base-registrar:hca-token' },
      ({ name, tokenId }) => `approval-${tokenId ?? name ?? 'registration'}`,
    )
    .with({ type: 'approval' }, ({ approvalId }) => `approval-${approvalId}`)
    .with({ type: 'atomic-batch' }, ({ index }) => `atomic-batch-${index}`)
    .with({ type: 'cleanup' }, ({ approvalId }) => `cleanup-${approvalId}`)
    .exhaustive()

type WalletConfirmationStepsDialogProps = {
  readonly steps: readonly MigrationStepDescriptor[]
}

export const WalletConfirmationStepsDialog = ({
  steps,
}: WalletConfirmationStepsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="cursor-pointer rounded-xs font-semibold underline decoration-ens-garnet-900/35 decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-ens-garnet-900 hover:decoration-ens-garnet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ens-garnet-900/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ens-garnet-200 motion-reduce:duration-0"
          type="button"
        >
          <Plural
            one="# wallet confirmation"
            other="# wallet confirmations"
            value={steps.length}
          />
        </button>
      </DialogTrigger>

      <DialogContent
        className="gap-0 overflow-hidden border-0 bg-ens-garnet-50 p-0 shadow-lg motion-reduce:duration-0 sm:max-w-[440px]"
        overlayClassName="bg-ens-garnet-900/50"
      >
        <DialogHeader className="gap-1.5 px-5 pt-5 pr-12 pb-3 text-left sm:px-6 sm:pt-6 sm:pr-12">
          <DialogTitle className="text-balance font-normal text-ens-garnet-900 text-xl leading-tight tracking-tight">
            <Trans>Wallet confirmations</Trans>
          </DialogTitle>
          <DialogDescription className="text-pretty text-ens-garnet-800/75 text-sm leading-normal">
            <Plural
              one="Your wallet will show one request."
              other="Your wallet will show # requests in this order."
              value={steps.length}
            />
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-96 overflow-y-auto px-5 py-1 sm:px-6">
          {steps.map((step, index) => (
            <li
              className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 py-3"
              key={stepKey(step)}
            >
              <span className="pt-0.5 font-semi-mono text-ens-garnet-800/60 text-sm tabular-nums">
                {index + 1}.
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <StepCopy step={step} />
              </div>
            </li>
          ))}
        </ol>

        <p className="text-pretty px-5 pt-2 pb-5 text-ens-garnet-800/70 text-xs leading-normal sm:px-6 sm:pb-6">
          <Trans>
            Nothing is signed automatically. Review every request in your
            wallet.
          </Trans>
        </p>
      </DialogContent>
    </Dialog>
  )
}
