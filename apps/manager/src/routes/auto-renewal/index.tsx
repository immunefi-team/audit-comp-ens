import { Trans } from '@lingui/react/macro'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  AutoRenewalItem,
  NonAutoRenewalWarning,
} from '@/features/auto-renewal/components'
import { NON_AUTO_RENEWALS, RENEWALS } from '@/features/auto-renewal/MOCKS'
import { PaymentMethodList } from '@/features/payment/components'
import { PaymentMethodAdd } from '@/features/payment/components/add'

export const Route = createFileRoute('/auto-renewal/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto my-5 max-w-sm space-y-4">
      <NonAutoRenewalWarning nonAutoRenewals={NON_AUTO_RENEWALS} />
      <h1 className="font-bold text-2xl">
        <Trans>Manage Renewals</Trans>
      </h1>
      <div className="space-y-4">
        {RENEWALS.map((renewal) => (
          <AutoRenewalItem autoRenewal={renewal} key={renewal.name} />
        ))}
      </div>
      <PaymentMethodAdd />
      <ClientOnly>
        <PaymentMethodList />
      </ClientOnly>
      <Button className="w-full" size="lg" variant="default">
        <Trans>Confirm</Trans>
      </Button>
    </div>
  )
}
