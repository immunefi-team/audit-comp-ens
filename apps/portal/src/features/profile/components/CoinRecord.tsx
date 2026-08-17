import {
  coinNameToTypeMap,
  type coinTypeToNameMap,
} from '@ensdomains/address-encoder'
import { Link } from '@tanstack/react-router'
import { EntityActionCopy } from '@/components/EntityAction'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

type CoinType = keyof typeof coinTypeToNameMap

const icons: Partial<Record<CoinType, string>> = {
  // EVM
  [coinNameToTypeMap.eth]: '/icons/eth.svg',
  [coinNameToTypeMap.op]: '/icons/op.svg',
  [coinNameToTypeMap.arb1]: '/icons/arb.svg',
  [coinNameToTypeMap.base]: '/icons/base.svg',
  [coinNameToTypeMap.linea]: '/icons/linea.svg',
  [coinNameToTypeMap.scr]: '/icons/scroll.svg',
  [coinNameToTypeMap.mantle]: '/icons/mantle.svg',
  [coinNameToTypeMap.bnb]: '/icons/bnb.svg',

  // non-EVM
  [coinNameToTypeMap.btc]: '/icons/btc.svg',
  [coinNameToTypeMap.doge]: '/icons/doge.svg',
  [coinNameToTypeMap.sol]: '/icons/sol.svg',
  [coinNameToTypeMap.strk]: '/icons/strk.svg',
} as const

export type CoinTypeWithIcon = keyof typeof icons

export const CoinRecord = ({
  name,
  coinType,
  value,
}: {
  name: string
  coinType: CoinTypeWithIcon
  value?: string
}) => {
  if (!value) return null
  return (
    <HoverCard openDelay={150} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Link
          to="/$name/address"
          params={{ name }}
          aria-label={`${coinType} address — view address resolution`}
          className={cn(
            'block rounded-full outline-hidden transition-shadow duration-150',
            'hover:ring-[3px] hover:ring-neutral-8',
            'focus-visible:ring-[3px] focus-visible:ring-neutral-8',
          )}
        >
          <img
            src={icons[coinType]}
            alt={coinType}
            className="block size-6 rounded-full"
          />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-auto max-w-(--radix-hover-card-content-available-width) border-0 bg-transparent p-0 shadow-none"
      >
        <EntityActionCopy
          value={value}
          label={value}
          font="mono"
          className="max-w-full shadow-sm"
        />
      </HoverCardContent>
    </HoverCard>
  )
}
