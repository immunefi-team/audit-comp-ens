import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { makeLabelNodeAndParent } from '@ensdomains/ensjs/utils'
import { useQuery } from '@tanstack/react-query'
import { AlertCircleIcon } from 'lucide-react'
import { ShieldIcon } from '@/assets/icons'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  DataBlockCard,
  DataBlockCardError,
} from '@/features/dashboard/components'
import { getBurnedFuseCountQueryOptions } from '@/features/namewrapper/hooks/useBurnedFuseCount'
import { getNameRolesAccountsQueryOptions } from '@/features/roles/hooks/useNameRoleAccounts'
import { sepoliaWithEns } from '@/lib/wagmi'
import type { ProtocolVersion } from '@/utils/types'

const v2EthRegistry = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensRegistry',
})

interface ProtocolVersionWithCounterProps {
  name: string
  protocolVersion: ProtocolVersion
}

const RoleCount = ({ name }: { name: string }) => {
  const { data, isLoading, error } = useQuery(
    getNameRolesAccountsQueryOptions({
      ...makeLabelNodeAndParent(name),
      registryAddress: v2EthRegistry,
      fromBlock: 9782822n,
    }),
  )

  if (error)
    return (
      <DataBlockCardError
        icon={AlertCircleIcon}
        message="Failed to load roles"
      />
    )
  if (isLoading) return <LoadingSpinner />

  return (
    <DataBlockCard
      to="/$name/roles"
      params={{ name }}
      icon={ShieldIcon}
      label="Role holders"
      value={(data || { size: 0 }).size}
    />
  )
}

const FuseCount = ({ name }: { name: string }) => {
  const { data, isLoading, error } = useQuery(
    getBurnedFuseCountQueryOptions({ name }),
  )

  if (error)
    return (
      <DataBlockCardError
        icon={AlertCircleIcon}
        message="Failed to load fuses"
      />
    )
  if (isLoading) return <LoadingSpinner />

  if (data === null) return null

  return (
    <DataBlockCard
      to="/$name/fuses"
      params={{ name }}
      icon={ShieldIcon}
      label="Fuses burned"
      value={data}
    />
  )
}

export const ProtocolVersionWithCounter = ({
  name,
  protocolVersion,
}: ProtocolVersionWithCounterProps) => {
  return protocolVersion === 'ENSv1' ? (
    <FuseCount name={name} />
  ) : (
    <RoleCount name={name} />
  )
}
