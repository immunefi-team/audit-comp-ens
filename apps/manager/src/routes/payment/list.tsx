import { Trans } from '@lingui/react/macro'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { useSelector } from '@xstate/react'
import { LinkButton } from '@/components/ui/button'
import { PaymentMethodList } from '@/features/payment/components'
import { paymentMethodsStore } from '@/features/payment/stores/payment-methods'

export const Route = createFileRoute('/payment/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const paymentMethods = useSelector(
    paymentMethodsStore,
    (state) => state.context.paymentMethods,
  )
  return (
    <div className="mx-auto my-5 max-w-sm">
      {paymentMethods.length > 0 ? (
        <ClientOnly>
          <PaymentMethodList />
        </ClientOnly>
      ) : (
        <>
          <div className="text-gray-500">
            <Trans>No payment methods found.</Trans>
          </div>
          <LinkButton className="w-full" to="/payment/add" variant="secondary">
            <Trans>Add Payment Method</Trans>
          </LinkButton>
        </>
      )}
    </div>
  )
}
