import { Trans, useLingui } from '@lingui/react/macro'
import { XCircle } from 'lucide-react'
import { DomainCard } from '@/components/atoms/DomainCard/DomainCard'
import { Button } from '@/components/ui/button'
import { RegisterV2Context } from '../../state/registrationUi.context'

export const FailureStep = () => {
  const { t } = useLingui()
  const { uiActor, label } = RegisterV2Context.use()
  const message = RegisterV2Context.useSelector(
    (state) => state.context.lastErrorMessage,
  )

  return (
    <div className="mx-auto mt-12 mb-4 w-full-[32px] max-w-6xl space-y-6.5">
      <div className="flex items-start gap-3 rounded-lg border border-ens-garnet-dust bg-ens-garnet-dust/15 p-4">
        <XCircle
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-ens-garnet-dense"
        />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-ens-garnet-dense text-sm leading-5">
            <Trans>Registration Failed</Trans>
          </p>
          <p className="text-ens-garnet-dense/70 text-sm leading-5">
            {message ??
              t`The registration for ${label}.eth could not be completed. You can retry or go back to adjust your settings.`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-16">
        <div className="w-full lg:w-1/2">
          <DomainCard domainName={`${label}.eth`} variant="garnet" />
        </div>

        <div className="flex w-full flex-col gap-6 lg:w-1/2">
          <div className="flex flex-col gap-1.5">
            <h3 className="font-medium text-ens-blue-dark text-xl tracking-tight">
              <Trans>What would you like to do?</Trans>
            </h3>
            <p className="text-ens-gray text-sm">
              <Trans>
                Retrying will attempt the registration again from where it left
                off.
              </Trans>
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => uiActor.send({ type: 'retry' })}
              size="xl"
              type="button"
              variant="blue"
            >
              <Trans>Try Again</Trans>
            </Button>
            <Button
              className="flex-1"
              onClick={() => uiActor.send({ type: 'cancel' })}
              size="xl"
              type="button"
              variant="lightBlue"
            >
              <Trans>Back to Quote</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
