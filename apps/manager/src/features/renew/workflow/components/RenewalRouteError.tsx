import { Trans } from '@lingui/react/macro'
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/button'
import { RenewPageLayout } from './RenewPageLayout'

export const RenewalRouteError = ({
  error,
  name,
  reset,
}: {
  readonly error: Error
  readonly name: string
  readonly reset: () => void
}) => (
  <RenewPageLayout>
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border border-ens-quartz-250 bg-white px-5 py-10 text-center shadow-temp-card sm:px-10 sm:py-12">
      <span className="flex size-12 items-center justify-center rounded-full bg-ens-garnet-100 text-ens-garnet-500">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-5 font-medium text-2xl text-ens-lapis-900 tracking-tight">
        <Trans>This name can’t be renewed here</Trans>
      </h1>
      <p className="mt-3 max-w-md text-ens-quartz-500 text-sm leading-5">
        {error.message || (
          <Trans>We couldn’t confirm that this name is renewable.</Trans>
        )}
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        <LinkButton
          className="h-14 w-full"
          params={{ name }}
          size="lg"
          to="/$name"
          variant="lightBlue"
        >
          <ArrowLeft aria-hidden="true" />
          <Trans>Back to profile</Trans>
        </LinkButton>
        <Button
          className="h-14 w-full"
          onClick={reset}
          size="lg"
          type="button"
          variant="blue"
        >
          <RefreshCw aria-hidden="true" />
          <Trans>Try again</Trans>
        </Button>
      </div>
    </div>
  </RenewPageLayout>
)
