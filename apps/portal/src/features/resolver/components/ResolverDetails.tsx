import type { ReactNode } from 'react'
import { ExternalLink } from 'react-external-link'
import type { Address } from 'viem'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { InfoRow } from '@/features/profile/components/InfoRow'
import { useSupportsInterfaces } from '@/hooks/useSupportsInterfaces'
import {
  RESOLVER_FEATURES,
  RESOLVER_INTERFACE_IDS,
  type ResolverInterfaceName,
} from '@/lib/constants/resolverInterfaceIds'
import { Datapoint, type DatapointProps } from '../../../components/Datapoint'

const SupportedFeatures = ({
  resolverAddress,
}: {
  resolverAddress: Address
}) => {
  const {
    data: supportsInterfaces,
    error,
    isLoading,
  } = useSupportsInterfaces({
    address: resolverAddress,
    interfaces: Object.values(RESOLVER_INTERFACE_IDS),
  })

  const supportedInterfaces = Object.keys(RESOLVER_INTERFACE_IDS)
    .filter((_, index) => supportsInterfaces?.[index])
    .map((name) => {
      const interfaceName = name as ResolverInterfaceName
      return RESOLVER_FEATURES[interfaceName]
    })
    .filter((feature) => feature?.name && feature?.link)

  if (isLoading) return <LoadingSpinner title="Loading..." />
  if (error) return <div>Error: {error.message}</div>
  if (!supportsInterfaces) return <div>No data</div>

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-p text-foreground">
      {supportedInterfaces.map((feature) => (
        <ExternalLink
          key={feature.name}
          href={feature.link}
          className="underline transition-colors hover:text-primary"
        >
          {feature.name}
        </ExternalLink>
      ))}
    </div>
  )
}

export const ResolverDetails = ({
  resolverAddress,
  data,
  typeValue,
}: {
  resolverAddress: Address
  data: DatapointProps[]
  /** Type-row value (e.g. {@link ResolverTypeValue}) — rendered first. */
  typeValue?: ReactNode
}) => {
  return (
    <div className="flex flex-col">
      {typeValue != null && <InfoRow label="Type">{typeValue}</InfoRow>}
      {data.map((item) => (
        <InfoRow key={item.label} label={item.label}>
          <Datapoint {...item} />
        </InfoRow>
      ))}
      <InfoRow label="Interfaces">
        <SupportedFeatures resolverAddress={resolverAddress} />
      </InfoRow>
    </div>
  )
}
