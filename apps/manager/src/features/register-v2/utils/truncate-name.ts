export const truncateName = (
  label: string,
  tld: string = 'eth',
  maxLength: number = 10,
) => {
  if (label.length <= maxLength) {
    return `${label}.${tld}`
  }

  const middleIndex = Math.floor(maxLength / 2)

  return `${label.slice(0, middleIndex)}…${label.slice(label.length - middleIndex)}.${tld}`
}
