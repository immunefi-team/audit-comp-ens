import { Trans } from '@lingui/react/macro'
import { CheckCircle2 } from 'lucide-react'

export const RenewalCompletionBanner = () => {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-ens-peridot-border bg-ens-peridot-bg p-4">
      <CheckCircle2
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-ens-peridot-text-dark"
      />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ens-peridot-text-dark text-sm leading-5">
          <Trans>Renewal Complete!</Trans>
        </p>
        <p className="text-ens-peridot-text-medium text-sm leading-5">
          <Trans>The ENS domain has been successfully renewed.</Trans>
        </p>
      </div>
    </div>
  )
}
