import { TIME_UNITS } from '@/utils/time'

export type AutoRenewal = {
  name: string
  expires: number
  price: number
}

export const RENEWALS: AutoRenewal[] = [
  {
    name: 'erin.eth',
    expires: Date.now() + TIME_UNITS.DAY * 15,
    price: 160,
  },
  {
    name: 'eri.eth',
    expires: Date.now() + TIME_UNITS.DAY * 28,
    price: 160,
  },
  {
    name: 'erinbeau.eth',
    expires: Date.now() + TIME_UNITS.DAY * 90,
    price: 160,
  },
]

export const NON_AUTO_RENEWALS: AutoRenewal[] = [
  {
    name: 'erni.eth',
    expires: Date.now() + TIME_UNITS.DAY * 15,
    price: 160,
  },
]
