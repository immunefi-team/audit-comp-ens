import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { namehash } from 'viem'
import { useReadContract } from 'wagmi'
import { ShieldPersonIcon } from '@/assets/icons'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { InfoRow } from '@/features/profile/components/InfoRow'
import { Owner } from '@/features/profile/components/Owner'
import { sepoliaWithEns } from '@/lib/wagmi'

const abi = [
  {
    constant: true,
    inputs: [
      {
        internalType: 'bytes32',
        name: 'node',
        type: 'bytes32',
      },
    ],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ensRegistryAddress = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensLegacyRegistry',
})

export const V1NameManagerRecord = ({
  name,
  className,
  asRow,
}: {
  name: string
  className?: string
  asRow?: boolean
}) => {
  const {
    data: managerAddress,
    isLoading,
    error,
  } = useReadContract({
    abi,
    functionName: 'owner',
    args: [namehash(name)],
    address: ensRegistryAddress,
  })

  // Row-shaped transient states: the full-size Loading/Error blocks would
  // break the compact header list this renders inside when `asRow` is set.
  if (error) {
    if (asRow)
      return (
        <InfoRow icon={ShieldPersonIcon} label="Manager" className={className}>
          <span className="text-sm text-muted-foreground">
            Failed to load manager
          </span>
        </InfoRow>
      )
    return (
      <ErrorMessage
        compact
        description="Error fetching the manager. Please refresh the page."
      />
    )
  }
  if (isLoading) {
    if (asRow)
      return (
        <InfoRow icon={ShieldPersonIcon} label="Manager" className={className}>
          <span className="text-sm text-muted-foreground">Loading</span>
        </InfoRow>
      )
    return <LoadingMessage title="Loading manager" />
  }

  return (
    <Owner
      label="Manager"
      owner={managerAddress}
      className={className}
      asRow={asRow}
    />
  )
}
