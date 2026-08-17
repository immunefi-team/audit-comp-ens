import { createFileRoute } from '@tanstack/react-router'
import { PaymentMethodAddScreen } from '@/features/payment/components/add'

export const Route = createFileRoute('/payment/add')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto my-5 max-w-sm">
      <PaymentMethodAddScreen />
    </div>
  )
}
