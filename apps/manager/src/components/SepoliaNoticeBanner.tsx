import { Trans } from '@lingui/react/macro'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { tw } from '@/utils/tailwind'

const LAST_SEPOLIA_DEPLOYMENT_DATE = 'July 30, 2026'

export const SepoliaNoticeBanner = ({
  className,
}: {
  readonly className?: string
}) => {
  return (
    <Alert className={tw('mx-auto max-w-7xl', className)} variant="warning">
      <AlertDescription>
        <Trans>
          Notice: ENS v2 is in active development. Registered names on Sepolia
          and state data may be reset periodically due to routine contract
          deployments. The most recent deployment was on{' '}
          {LAST_SEPOLIA_DEPLOYMENT_DATE}.
        </Trans>
      </AlertDescription>
    </Alert>
  )
}
