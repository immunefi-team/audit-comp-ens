export type PaymentMethod = {
  id: string
  name: string
  type: 'card' | 'google-pay' | 'apple-pay' | 'paypal'
  expires: string
}
