import type { Address, Hash } from 'viem'
import { isAddress } from 'viem'
import { useEnsName, useTransaction } from 'wagmi'
import { EntityBadge } from '@/components/EntityBadge'
import { useBlockExplorerAddressUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

interface AccountBadgeProps {
  /** The account address, when known. */
  readonly address?: Address
  /** When no address is known (e.g. "Renew by …"), resolve this tx's sender instead. */
  readonly txHash?: Hash
  readonly full?: boolean
  /**
   * Gate the network resolution (tx sender + reverse lookup). Defaults to
   * eager; pass an in-view signal to defer it on long, always-visible lists.
   */
  readonly enabled?: boolean
}

/** Full value on desktop, truncated on mobile — for hashes/addresses in expanded detail. */
export const FullOnDesktop = ({ value }: { value: string }) => (
  <>
    <span className="lg:hidden">{truncateAddress(value)}</span>
    <span className="hidden lg:inline">{value}</span>
  </>
)

/**
 * Renders an account as its **primary ENS name** (no avatar) when one resolves,
 * otherwise the truncated address. Optionally resolves the address from a transaction's
 * sender first. Kept here (not in EntityBadge) so the shared badge stays presentational.
 *
 * TODO(indexer): once `Event.from` is indexed, pass it as `address` and drop the tx RPC.
 */
export const AccountBadge = ({
  address,
  txHash,
  full = false,
  enabled = true,
}: AccountBadgeProps) => {
  const needsTx = !!txHash && !address
  const { data: tx, isPending } = useTransaction({
    hash: txHash,
    query: { enabled: needsTx && enabled },
  })

  const resolved: Address | undefined =
    address ??
    (tx?.from && isAddress(tx.from, { strict: false }) ? tx.from : undefined)

  const { data: name } = useEnsName({
    address: resolved,
    query: { enabled: !!resolved && enabled },
  })
  const explorerUrl = useBlockExplorerAddressUrl(resolved)

  if (!resolved) {
    return (
      <span className="text-muted-foreground text-p">
        {needsTx && enabled && isPending ? '…' : '—'}
      </span>
    )
  }

  if (name) {
    return (
      <EntityBadge
        variant="name"
        name={name}
        address={resolved}
        etherscanHref={explorerUrl}
        compact
      >
        {name}
      </EntityBadge>
    )
  }

  return (
    <EntityBadge
      variant="address"
      address={resolved}
      etherscanHref={explorerUrl}
      compact
    >
      {full ? <FullOnDesktop value={resolved} /> : truncateAddress(resolved)}
    </EntityBadge>
  )
}
