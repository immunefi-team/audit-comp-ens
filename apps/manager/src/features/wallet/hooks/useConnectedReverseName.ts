import { useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { useSmartAccountContext } from '@/lib/smart-account'

export const useConnectedReverseName = () => {
  const { ownerAddress } = useSmartAccountContext()
  const { address } = useConnection()
  const reverseAddress = ownerAddress ?? address

  const reverseName = useQuery({
    ...profileReverseNameQuery(reverseAddress ?? undefined),
    enabled: !!reverseAddress,
  })

  return reverseName
}
