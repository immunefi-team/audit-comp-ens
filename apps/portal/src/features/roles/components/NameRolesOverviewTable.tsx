import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Fragment, useState } from 'react'
import { type Address, zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { Button } from '@/components/ui/button'
import { getNameLabels } from '@/features/registry/utils/nameUtils'
import { RolesAddUserSheet } from '@/features/roles/components/RolesAddUserSheet'
import { RolesTable } from '@/features/roles/components/RolesTable'
import { getNameRolesAccountsQueryOptions } from '@/features/roles/hooks/useNameRoleAccounts'
import { getNameRolesForAccountQueryOptions } from '@/features/roles/hooks/useNameRolesForAccount'
import { isAdminRole } from '@/lib/roles/permissions'

const ROLES_FROM_BLOCK = 9783977n

const V2NameRoles = ({
  name,
  registryAddress,
  canManageRoles,
}: {
  name: string
  registryAddress: Address
  canManageRoles: boolean
}) => {
  const { currentLabel, labels } = getNameLabels(name)

  const nameRolesQuery = useQuery({
    ...getNameRolesAccountsQueryOptions({
      label: currentLabel,
      registryAddress,
      fromBlock: ROLES_FROM_BLOCK,
    }),
    enabled: labels.length >= 2,
  })

  if (nameRolesQuery.isLoading)
    return <LoadingSpinner title="Loading role accounts" />

  if (nameRolesQuery.error)
    return (
      <ErrorMessage
        compact
        description="Error fetching role accounts. Please refresh the page."
      />
    )

  if (!nameRolesQuery.data)
    return <NoResultsMessage title="No role accounts" className="mx-0" />

  return (
    <RolesTable
      roles={nameRolesQuery.data}
      name={name}
      canManageRoles={canManageRoles}
      registryAddress={registryAddress}
    />
  )
}

const AddUserButton = ({
  canManageRoles,
  onClick,
}: {
  canManageRoles: boolean
  onClick: () => void
}) => {
  if (!canManageRoles) return null

  return (
    <Button
      variant="default"
      className="flex items-center gap-2"
      onClick={onClick}
    >
      <Plus className="size-4" />
      Add user
    </Button>
  )
}

export const NameRolesOverviewTable = ({
  name,
  registryAddress,
}: {
  name: string
  registryAddress: Address
}) => {
  const [addUserOpen, setAddUserOpen] = useState(false)

  const { address } = useConnection()
  const label = name.split('.')[0]

  const { data: currentAccountRoles } = useQuery({
    ...getNameRolesForAccountQueryOptions({
      registryAddress,
      label,
      account: address ?? zeroAddress,
    }),
    enabled: Boolean(address),
  })

  const canManageRoles = Boolean(
    currentAccountRoles?.decoded?.find(isAdminRole),
  )

  return (
    <Fragment>
      <div className="flex items-center justify-between">
        <h3 className="text-caps leading-none">parent registry roles</h3>
        {address && (
          <AddUserButton
            canManageRoles={canManageRoles}
            onClick={() => setAddUserOpen(true)}
          />
        )}
      </div>
      <V2NameRoles
        name={name}
        registryAddress={registryAddress}
        canManageRoles={canManageRoles}
      />
      <RolesAddUserSheet
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        name={name}
        registryAddress={registryAddress}
      />
    </Fragment>
  )
}
