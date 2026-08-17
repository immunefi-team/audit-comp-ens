import { FocusIcon } from 'lucide-react'
import type { Address } from 'viem/accounts'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useIsPermissionedResolver } from '@/features/resolver/hooks/useIsPermissionedResolver'

export const ResolverType = ({
  resolverAddress,
}: {
  resolverAddress: Address
}) => {
  const {
    data: isPermissionedResolver,
    isLoading,
    error,
  } = useIsPermissionedResolver({ resolverAddress })

  if (isLoading) return <LoadingSpinner title="Loading..." />
  if (error)
    return <>{error instanceof Error ? error.message : 'Failed to load data'}</>
  if (!isPermissionedResolver) return null

  return (
    <div className="flex flex-row p-4 sm:p-6 gap-4 sm:gap-6 rounded-sm border border-border w-full flex-1 items-center">
      <FocusIcon className="size-10" />
      <div className="flex flex-col">
        <span className="font-medium">Type</span>
        <span>Permissioned Resolver</span>
      </div>
    </div>
  )
}
