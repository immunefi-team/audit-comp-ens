import { coinTypeToNameMap } from '@ensdomains/address-encoder'
import { coinIcons } from '@/assets/coins/'
import type { AddressRecordDef } from './types'

const rawAddressRecords: AddressRecordDef[] = Object.entries(
  coinTypeToNameMap,
).map(([coinType, [notation, name]]) => ({
  coinType: Number(coinType),
  name,
  notation,
  icon: coinIcons[notation],
}))

// Optional custom sort preference for addresses (by coinType or notation)
// Put most important chains first; remaining follow encoder order
const PREFERRED_ADDRESS_ORDER: Array<number | { notation: string }> = [
  60, // ETH
  0, // BTC
  { notation: 'OP' },
  { notation: 'ARB' },
  { notation: 'MATIC' },
  { notation: 'ETH' }, // for common L2s that share ETH notation
  { notation: 'BNB' },
  { notation: 'AVAX' },
]

const addressPreferenceIndex = new Map<string, number>()
for (const [index, pref] of PREFERRED_ADDRESS_ORDER.entries()) {
  if (typeof pref === 'number') addressPreferenceIndex.set(`ct:${pref}`, index)
  else addressPreferenceIndex.set(`nt:${pref.notation}`, index)
}

const getAddressPreference = ({ coinType, notation }: AddressRecordDef) => {
  return Math.min(
    addressPreferenceIndex.get(`ct:${coinType}`) ?? Infinity,
    notation
      ? (addressPreferenceIndex.get(`nt:${notation}`) ?? Infinity)
      : Infinity,
  )
}

export const addressRecords: AddressRecordDef[] = [...rawAddressRecords].sort(
  (a, b) => {
    const aPref = getAddressPreference(a)
    const bPref = getAddressPreference(b)
    if (aPref !== bPref) return aPref - bPref
    return a.coinType - b.coinType
  },
)
