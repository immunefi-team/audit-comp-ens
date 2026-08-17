/**
 * Pure helpers for the choose-primary-name dialog.
 *
 * Business logic kept outside the React component for testability.
 */

import type { ProfileRecordsResult } from '@/features/profile/service/profileRecords'

const ETH_COIN_TYPE = 60

export function getEthAddressFromRecords(
  records: ProfileRecordsResult | undefined,
): string | undefined {
  return records?.coins?.find((c) => c.coinType === ETH_COIN_TYPE)?.value
}

export function hasMatchingEthAddress(
  records: ProfileRecordsResult | undefined,
  walletAddress: string | undefined,
): boolean {
  if (!walletAddress) return false
  const ethAddress = getEthAddressFromRecords(records)
  if (!ethAddress) return false
  return ethAddress.toLowerCase() === walletAddress.toLowerCase()
}
