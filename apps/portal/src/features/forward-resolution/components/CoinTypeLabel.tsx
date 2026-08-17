import type { ReverseRegistrarChainId } from '@ens-apps/l2-primary/v1'
import { LinkIcon } from 'lucide-react'
import { icons, names } from '@/lib/reverseRegistrarChainId'

interface CoinTypeLabelProps {
  coin: number
}

export const CoinTypeLabel = ({ coin }: CoinTypeLabelProps) =>
  coin in icons && coin in names ? (
    <span
      className="flex flex-row gap-1 p-0.5 pr-2 bg-secondary rounded-2xl items-center"
      key={coin}
    >
      <img
        key={coin}
        className="size-6"
        alt={coin.toString()}
        src={icons[coin as ReverseRegistrarChainId]}
      />{' '}
      {names[coin as ReverseRegistrarChainId]}
    </span>
  ) : coin === 0 ? (
    <span
      className="flex flex-row gap-1 p-0.5 pr-2 bg-secondary rounded-2xl items-center"
      key={coin}
    >
      <LinkIcon className="size-4" />
      <span>Default</span>
    </span>
  ) : (
    <span key={coin}>{coin}</span>
  )
