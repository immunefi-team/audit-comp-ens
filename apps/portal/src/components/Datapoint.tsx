import type { Address } from 'viem'
import type { HttpsUrl } from '@/utils/types'
import { CopyableRecord } from './CopyableRecord'
import { EntityBadge, type EntityVariant } from './EntityBadge'

export type DatapointProps = {
  label: string
  value: string
  info?: string
  href?: HttpsUrl
  variant?: EntityVariant
}

/**
 * A datapoint's value cell. The row label comes from the surrounding header
 * list (`InfoRow`), so this renders only the value: an EntityBadge for
 * name/address/contract variants, a copyable record otherwise.
 */
export const Datapoint = ({ value, href, variant }: DatapointProps) => {
  return (
    <>
      {variant ? (
        <EntityBadge
          variant={variant}
          name={variant === 'name' ? value : undefined}
          address={
            variant === 'address' || variant === 'contract'
              ? (value as Address)
              : undefined
          }
          copyValue={value}
          etherscanHref={href}
        >
          {value}
        </EntityBadge>
      ) : (
        <CopyableRecord value={value} href={href} />
      )}
    </>
  )
}
