export const getDurationDiscount = (
  selectedPrice: number | undefined,
  baseYearPrice: number | undefined,
  years: number,
) => {
  if (!selectedPrice || !baseYearPrice || years <= 0) {
    return 0
  }

  return Math.round((1 - selectedPrice / (baseYearPrice * years)) * 100)
}
