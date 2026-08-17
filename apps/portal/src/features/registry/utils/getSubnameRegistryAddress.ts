import { type Address, zeroAddress } from 'viem'

export function getSubnameRegistryAddress(
  registries: readonly (Address | null)[] | null | undefined,
): Address | undefined {
  if (!registries || registries.length === 0) {
    return undefined
  }
  const [first, second] = registries
  return first !== null && first !== zeroAddress ? first : (second ?? undefined)
}
