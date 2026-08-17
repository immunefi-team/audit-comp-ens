import { truncateAddress } from '@/lib/utils'

export const getHeaderDisplayName = ({
  isLoading,
  ownerAddress,
  reverseName,
}: {
  readonly isLoading: boolean
  readonly ownerAddress: string | null | undefined
  readonly reverseName: string | null
}) => {
  if (isLoading) {
    return 'Initializing...'
  }

  if (reverseName) {
    return reverseName
  }

  if (ownerAddress) {
    return truncateAddress(ownerAddress)
  }

  return 'Connected'
}
