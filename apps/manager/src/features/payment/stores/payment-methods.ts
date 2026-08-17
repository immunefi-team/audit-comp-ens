import { produce } from 'immer'
import { createPersistedStore } from '@/utils/xstate-store'
import type { PaymentMethod } from '../types'

export const paymentMethodsStore = createPersistedStore(
  {
    context: {
      paymentMethods: [] as PaymentMethod[],
    },
    on: {
      add: (context, event: { paymentMethod: PaymentMethod }) =>
        produce(context, (draft) => {
          draft.paymentMethods.push(event.paymentMethod)
        }),
      remove: (context, event: { id: string }) =>
        produce(context, (draft) => {
          draft.paymentMethods = draft.paymentMethods.filter(
            (pm) => pm.id !== event.id,
          )
        }),
      setDefault: (context, event: { index: number }) =>
        produce(context, (draft) => {
          // index 0 will be the default payment method so move the item to the first position
          const item = draft.paymentMethods[event.index]
          if (item) {
            draft.paymentMethods.splice(event.index, 1)
            draft.paymentMethods.unshift(item)
          }
        }),
    },
  },
  {
    key: '@manager-v4/payment-methods',
  },
)
