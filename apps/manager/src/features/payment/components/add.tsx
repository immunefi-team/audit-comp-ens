import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { ChevronDown, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Button, LinkButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { paymentMethodsStore } from '../stores/payment-methods'

export const PaymentMethodAdd = () => {
  return (
    <div className="space-y-3.5 rounded-md border border-gray-200 p-5">
      <div>
        <h2 className="font-medium text-lg">
          <Trans>Payment Methods</Trans>
        </h2>
        <div className="mb-4 text-gray-500 text-sm">
          <Trans>This card will be charged for your subscription.</Trans>
        </div>
      </div>
      <LinkButton className="w-full" to="/payment/add" variant="default">
        <PlusIcon />
        <Trans>Add Payment Method</Trans>
      </LinkButton>
    </div>
  )
}

const PaymentMethodAddScreenCardDetails = () => {
  const { t } = useLingui()
  return (
    <div className="flex flex-col gap-2 space-y-4">
      <h2 className="font-medium text-lg">
        <Trans>Add a credit card</Trans>
      </h2>
      <Input aria-label={t`Card number`} placeholder={t`Card number`} />
      <div className="flex gap-2">
        <Input aria-label={t`Card expiry date`} placeholder={t`MM/YY`} />
        <Input aria-label={t`Card security code`} placeholder={t`CVV`} />
      </div>
      <Input aria-label={t`Name on card`} placeholder={t`Name on card`} />
      <div className="flex gap-2">
        <Input aria-label={t`Billing zip code`} placeholder={t`Zip code`} />
        <Input aria-label={t`Billing country`} placeholder={t`Country`} />
      </div>
    </div>
  )
}

export const PaymentMethodAddScreen = () => {
  const [cardDetailsExpanded, setCardDetailsExpanded] = useState(false)
  const navigate = useNavigate()
  return (
    <div className="space-y-4 px-4">
      <div>
        <h2 className="font-medium text-lg">
          <Trans>Payment Methods</Trans>
        </h2>
        <div className="mb-4 text-gray-500 text-sm">
          <Trans>Choose how you'd like to pay for your subscription.</Trans>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          className="w-full justify-start"
          onClick={() => {
            paymentMethodsStore.trigger.add({
              paymentMethod: {
                id: `google-${Math.floor(Math.random() * 1000000)}`,
                name: 'Google',
                type: 'google-pay',
                expires: '01/2028',
              },
            })
            navigate({ to: '/payment/list' })
          }}
          variant="secondary"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
              <span className="font-bold text-white text-xs">G</span>
            </div>
            <Trans>Pay with Google</Trans>
          </div>
        </Button>

        <Button
          className="w-full justify-start"
          onClick={() => {
            paymentMethodsStore.trigger.add({
              paymentMethod: {
                id: `apple-${Math.floor(Math.random() * 1000000)}`,
                name: 'Apple',
                type: 'apple-pay',
                expires: '01/2028',
              },
            })
            navigate({ to: '/payment/list' })
          }}
          variant="secondary"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-black">
              <span className="font-bold text-white text-xs">A</span>
            </div>
            <Trans>Pay with Apple</Trans>
          </div>
        </Button>

        <Button
          className="w-full justify-start"
          onClick={() => {
            paymentMethodsStore.trigger.add({
              paymentMethod: {
                id: `paypal-${Math.floor(Math.random() * 1000000)}`,
                name: 'PayPal',
                type: 'paypal',
                expires: '01/2028',
              },
            })
            navigate({ to: '/payment/list' })
          }}
          variant="secondary"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
              <span className="font-bold text-white text-xs">P</span>
            </div>
            <Trans>Pay with PayPal</Trans>
          </div>
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="w-full border-gray-300 border-t" />
        <span className="px-2 text-gray-500">
          <Trans>or</Trans>
        </span>
        <div className="w-full border-gray-300 border-t" />
      </div>

      <Button
        className="w-full"
        onClick={() => setCardDetailsExpanded(true)}
        variant="default"
      >
        <PlusIcon />
        <Trans>Add a credit card</Trans>
      </Button>

      <div className="flex flex-col items-center justify-center gap-2 text-center leading-ens-tight">
        <div className="font-medium">
          <Trans>Add a Backup Payment Method</Trans>
        </div>
        <div className="text-gray-500">
          <Trans>
            The backup payment method will be charged if the default payment
            method fails.
          </Trans>
        </div>

        <ChevronDown
          className={clsx('size-6', cardDetailsExpanded && 'rotate-180')}
          onClick={() => setCardDetailsExpanded(!cardDetailsExpanded)}
        />
      </div>

      {cardDetailsExpanded && <PaymentMethodAddScreenCardDetails />}

      <div className="mt-12">
        <Button
          className="w-full"
          onClick={() => {
            paymentMethodsStore.trigger.add({
              paymentMethod: {
                id: `card-${Math.floor(Math.random() * 1000000)}`,
                name: `Visa **** ${Math.floor(Math.random() * 9000) + 1000}`,
                type: 'card',
                expires: '01/2028',
              },
            })
            navigate({ to: '/payment/list' })
          }}
          variant="default"
        >
          <Trans>Confirm</Trans>
        </Button>
      </div>
    </div>
  )
}
