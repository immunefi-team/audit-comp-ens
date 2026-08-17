import { getCoderByCoinType } from '@ensdomains/address-encoder'
import { getAddressRecordDef } from '@/features/profile/data/records'

export const getAddressRecordLabel = (coinType: number): string =>
  getAddressRecordDef(coinType)?.name ?? `Address ${coinType}`

export const validateAddressRecordValue = (
  coinType: number,
  value: string | undefined,
): string | undefined => {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return undefined

  try {
    getCoderByCoinType(coinType).decode(trimmed)
    return undefined
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unsupported coin')) {
      return 'Unsupported address type'
    }

    return `Enter a valid ${getAddressRecordLabel(coinType)} address`
  }
}
