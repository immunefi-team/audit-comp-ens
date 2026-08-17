import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem/accounts'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getResolverNameQueryOptions } from '../hooks/useResolverName'

export const ResolverPrimaryName = ({
  resolverAddress,
}: {
  resolverAddress: Address
}) => {
  const { data, isLoading, error } = useQuery(
    getResolverNameQueryOptions({ resolverAddress }),
  )

  if (isLoading) return <LoadingSpinner title="Loading..." />

  if (error)
    return <>{error instanceof Error ? error.message : 'Failed to load data'}</>

  if (!data) return null

  return (
    <div className="flex flex-row p-4 sm:p-6 gap-4 sm:gap-6 rounded-sm border border-border w-full flex-1">
      <NameAvatar name={data} height="40px" width="40px" />
      <div className="flex flex-col">
        <span className="font-medium">Primary Name</span>
        <span>{data}</span>
      </div>
    </div>
  )
}
