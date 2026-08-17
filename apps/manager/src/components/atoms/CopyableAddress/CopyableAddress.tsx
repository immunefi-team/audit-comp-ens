import { cn } from '@/lib/utils'
import { CopyToClipboard } from '../CopyToClipboard'

interface CopyableAddressProps {
  readonly address: string
  readonly className?: string
  readonly textClassName?: string
  /** Always show truncated address. When false, truncates on mobile only. */
  readonly truncate?: boolean
}

const shortenAddress = (value: string) =>
  `${value.slice(0, 6)}...${value.slice(-4)}`

export const CopyableAddress = ({
  address,
  className,
  textClassName,
  truncate = false,
}: CopyableAddressProps) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <span className={cn('font-mono', textClassName)}>
      {truncate ? (
        shortenAddress(address)
      ) : (
        <>
          <span className="md:hidden">{shortenAddress(address)}</span>
          <span className="hidden md:inline">{address}</span>
        </>
      )}
    </span>
    <CopyToClipboard className="size-4 text-muted-foreground" value={address} />
  </span>
)
