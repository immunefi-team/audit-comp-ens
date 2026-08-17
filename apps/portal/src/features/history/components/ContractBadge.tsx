import type { ComponentProps } from 'react'
import type { Address } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { useBlockExplorerAddressUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { getContractLabel } from '@/utils/ens/ensContractNames'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { FullOnDesktop } from './AccountBadge'

/** Contract chip with known ENS label / permissioned-registry fallback. */
export const ContractBadge = ({
  address,
  isRegistry,
  label: fallbackLabel,
  full = false,
  format = 'inline',
}: {
  readonly address: Address
  readonly isRegistry?: boolean
  readonly label?: string
  readonly full?: boolean
  readonly format?: ComponentProps<typeof EntityBadge>['format']
}) => {
  const explorerUrl = useBlockExplorerAddressUrl(address)
  const known = getContractLabel(address)
  const label =
    known ?? fallbackLabel ?? (isRegistry ? 'permissioned registry' : undefined)

  return (
    <EntityBadge
      variant="contract"
      address={address}
      label={label}
      isRegistry={known === 'permissioned registry' || (!!isRegistry && !known)}
      etherscanHref={explorerUrl}
      format={format}
      compact
    >
      {full ? <FullOnDesktop value={address} /> : truncateAddress(address)}
    </EntityBadge>
  )
}
