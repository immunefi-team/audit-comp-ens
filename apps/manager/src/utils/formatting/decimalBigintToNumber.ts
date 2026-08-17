import { formatUnits } from 'viem/utils'

export const decimalBigintToNumber = (
  value: bigint,
  decimals: number,
): number => {
  return Number(formatUnits(value, decimals))
}
