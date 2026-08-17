import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { profileAddressNamesQuery } from '@/features/profile/service/profileAddressNames'
import { useSmartAccountContextSafe } from '@/lib/smart-account/SmartAccountContext'
import { AddressProfileHeader } from './AddressProfileHeader'
import { AddressProfileNamesList } from './AddressProfileNamesList'
import { isViewingConnectedAddress } from './connectedAccounts.helpers'

export const AddressProfileView = ({
  address,
  primaryName,
}: {
  address: Address
  primaryName?: string
}) => {
  const { address: walletAddress } = useConnection()
  const smartAccount = useSmartAccountContextSafe()
  const isConnectedView = isViewingConnectedAddress({
    address,
    walletAddress,
    accountAddress: smartAccount?.accountAddress,
    ownerAddress: smartAccount?.ownerAddress,
  })

  const {
    data: addressNames = [],
    isPending,
    isError,
    isPlaceholderData,
  } = useQuery({
    ...profileAddressNamesQuery(address),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="mx-auto w-full max-w-[805px] space-y-6 px-4 pt-6 pb-12 md:space-y-[23px] md:pt-10">
      <AddressProfileHeader
        address={address}
        addressNames={addressNames}
        isNamesPending={isPending}
        primaryName={primaryName}
      />
      <AddressProfileNamesList
        addressNames={addressNames}
        isConnectedView={isConnectedView}
        isError={isError}
        isPending={isPending}
        isPlaceholderData={isPlaceholderData}
        primaryName={primaryName}
      />
    </div>
  )
}
