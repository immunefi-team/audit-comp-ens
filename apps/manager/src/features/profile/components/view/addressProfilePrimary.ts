import type { ProfileAddressName } from '@/features/profile/service/profileAddressNames'

export const findPrimaryAddressName = (
  names: readonly ProfileAddressName[] | undefined,
  primaryName?: string,
): ProfileAddressName | undefined => {
  if (!primaryName || !names) return undefined
  const normalized = primaryName.toLowerCase()
  return names.find((name) => name.label.toLowerCase() === normalized)
}
