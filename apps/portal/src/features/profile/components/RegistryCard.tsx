import { Link } from '@tanstack/react-router'
import type { Address } from 'viem'
import { HubIcon } from '@/assets/icons'
import type { ProtocolVersion } from '@/utils/types'
import { InfoRow } from './InfoRow'
import { RegistryLocation } from './RegistryLocation'

export const RegistryCard = ({
  name,
  registryAddress,
  asRow,
  protocolVersion,
}: {
  name: string
  // The PARENT registry that holds this name's label (e.g. the .eth registry
  // for `fresh.eth`, or fresh.eth's subregistry for `foo.fresh.eth`).
  // RegistryLocation will call `getSubregistry(firstLabel)` on it to find
  // this name's own subregistry — that's the address we want to display.
  registryAddress?: Address
  asRow?: boolean
  protocolVersion?: ProtocolVersion
}) => {
  // V1 names (DNS imports, legacy .eth) don't have per-name subregistries —
  // they all live under the V1 legacy registry. Showing it would be both
  // meaningless and misleading, so omit the row entirely.
  const isV1 = protocolVersion === 'ENSv1'
  if (isV1) return null

  if (asRow) {
    return (
      <InfoRow icon={HubIcon} label="Subregistry">
        {registryAddress ? (
          <RegistryLocation name={name} registryAddress={registryAddress} />
        ) : (
          <span className="font-semi-mono text-muted-foreground">None set</span>
        )}
      </InfoRow>
    )
  }

  return (
    <Link
      to="/$name/registry"
      params={{ name }}
      className="h-21.5 px-6 flex flex-row rounded-sm gap-6 items-center border border-border hover:bg-muted"
    >
      <HubIcon className="size-8 shrink-0 text-neutral-7" />
      <div className="flex-1 flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Subregistry</span>
        {registryAddress ? (
          <RegistryLocation name={name} registryAddress={registryAddress} />
        ) : (
          <span className="font-semi-mono text-muted-foreground">None set</span>
        )}
      </div>
    </Link>
  )
}
