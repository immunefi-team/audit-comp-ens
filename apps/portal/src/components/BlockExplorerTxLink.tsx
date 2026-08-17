import type { Hash } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { cn } from '@/lib/utils'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

interface BlockExplorerTxLinkProps {
  readonly txHash: Hash
  readonly chainId?: number
  readonly className?: string
  readonly inline?: boolean
}

/**
 * Renders an EntityBadge (tx) with block explorer link, copy, and Etherscan chips.
 */
export const BlockExplorerTxLink = ({
  txHash,
  chainId,
  className,
  inline = false,
}: BlockExplorerTxLinkProps) => {
  const href = useBlockExplorerTxUrl(txHash, chainId)

  return (
    <div
      className={cn(
        inline ? 'inline-flex items-center' : 'flex w-full items-center',
        className,
      )}
    >
      <EntityBadge variant="tx" copyValue={txHash} etherscanHref={href}>
        {truncateAddress(txHash)}
      </EntityBadge>
    </div>
  )
}
