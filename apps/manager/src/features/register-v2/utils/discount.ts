import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

export const calculateDiscount = (
  basePriceNumber: number,
  baseRate: bigint,
  duration: bigint,
): {
  basePriceWithoutDiscount: number
  discountAmount: number
  discountPercentage: number
} => {
  const basePriceWithoutDiscount = decimalBigintToNumber(
    duration * baseRate,
    12,
  )

  // If the base price is 0, or the base price without discount is 0, there is no discount
  if (basePriceNumber === 0 || basePriceWithoutDiscount === 0) {
    return {
      basePriceWithoutDiscount,
      discountAmount: 0,
      discountPercentage: 0,
    }
  }

  const discountAmount = Math.max(basePriceWithoutDiscount - basePriceNumber, 0)
  const discountPercentage = Math.round(
    (discountAmount / basePriceWithoutDiscount) * 100,
  )

  return {
    basePriceWithoutDiscount,
    discountAmount,
    discountPercentage,
  }
}
