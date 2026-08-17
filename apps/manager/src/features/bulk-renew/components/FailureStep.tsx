import { Trans } from '@lingui/react/macro'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'

const dialogTitleClassName =
  'text-left font-normal font-sans text-ens-quartz-900 text-xl tracking-[-0.4px]'

/** Terminal failure view: error banner + retry / back-to-confirm actions. */
export const FailureStep = ({
  errorMessage,
  onRetry,
  onBack,
}: {
  readonly errorMessage: string | undefined
  readonly onRetry: () => void
  readonly onBack: () => void
}) => (
  <>
    <DialogHeader>
      <DialogTitle className={dialogTitleClassName}>
        <Trans>Renewal failed</Trans>
      </DialogTitle>
    </DialogHeader>

    <div className="flex items-start gap-3 rounded-lg border border-ens-garnet-dust bg-ens-garnet-dust/15 p-4">
      <XCircle
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-ens-garnet-dense"
      />
      <div className="flex flex-col gap-1">
        <p className="font-medium font-sans text-ens-garnet-dense text-sm">
          <Trans>Something went wrong</Trans>
        </p>
        <p className="font-sans text-ens-garnet-dense/70 text-sm">
          {errorMessage ?? <Trans>The renewal could not be completed.</Trans>}
        </p>
      </div>
    </div>

    <div className="flex gap-3">
      <Button
        className="flex-1 uppercase"
        onClick={onBack}
        size="lg"
        type="button"
        variant="lightBlue"
      >
        <Trans>Back</Trans>
      </Button>
      <Button
        className="flex-1 uppercase"
        onClick={onRetry}
        size="lg"
        type="button"
        variant="blue"
      >
        <Trans>Try again</Trans>
      </Button>
    </div>
  </>
)
