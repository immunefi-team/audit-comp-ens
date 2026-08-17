import { Coins } from 'lucide-react'
import { STABLECOINS } from '@/features/shared/registration/nameUtils'
import { cn } from '@/lib/utils'

export interface StablecoinData {
  id?: string
  address: string
  symbol: string
  name?: string
  formattedBalance: string
  balance?: bigint
  chainInfo?: {
    name: string
    icon: string
  }
}

interface StablecoinListProps {
  stablecoins: StablecoinData[]
  title?: string
  showTitle?: boolean
  onStablecoinClick?: (stablecoin: StablecoinData) => void
  selectedStablecoinId?: string
  className?: string
  interactive?: boolean
}

export const StablecoinList = ({
  stablecoins,
  title = 'Stablecoins',
  showTitle = true,
  onStablecoinClick,
  selectedStablecoinId,
  className,
  interactive = false,
}: StablecoinListProps) => {
  // Get token info from STABLECOINS constants
  const getTokenInfo = (symbol: string, index: number) => {
    const stablecoin = Object.values(STABLECOINS).find(
      (coin) =>
        coin.name.includes(symbol) || coin.id.includes(symbol.toLowerCase()),
    )

    if (stablecoin) {
      // Color schemes for different stablecoins
      const colorSchemes = [
        // DAI - Orange theme
        {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
        },
        // USDC - Blue theme
        {
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        },
      ]
      const colorScheme = colorSchemes[index % colorSchemes.length]

      return {
        icon: '🪙',
        name: stablecoin.name,
        ...colorScheme,
      }
    }

    return {
      icon: '🪙',
      name: symbol,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    }
  }

  if (stablecoins.length === 0) {
    return null
  }

  const handleStablecoinClick = (stablecoin: StablecoinData) => {
    if (interactive && onStablecoinClick) {
      onStablecoinClick(stablecoin)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {showTitle && (
        <div className="flex items-center gap-2">
          <Coins className={cn('h-3 w-3', 'text-gray-500')} />
          <span className={cn('font-medium text-xs', 'text-gray-500')}>
            {title}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {stablecoins.map((stablecoin, index) => {
          const tokenInfo = getTokenInfo(stablecoin.symbol, index)
          const isSelected =
            selectedStablecoinId &&
            (stablecoin.id === selectedStablecoinId ||
              stablecoin.address === selectedStablecoinId)

          const ItemComponent = interactive ? 'button' : 'div'

          return (
            <ItemComponent
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200',
                'hover:shadow-sm',
                tokenInfo.bgColor,
                tokenInfo.borderColor,
                interactive && 'cursor-pointer',
                isSelected && 'ring-2 ring-blue-500',
              )}
              key={stablecoin.address}
              onClick={() => handleStablecoinClick(stablecoin)}
              type={interactive ? 'button' : undefined}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shadow-sm',
                  'bg-white',
                )}
              >
                <img
                  alt={tokenInfo.name}
                  className="h-5 w-5 rounded-full"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                  src={tokenInfo.icon}
                />
                <span className="hidden text-lg">
                  {tokenInfo.icon === '🪙' ? tokenInfo.icon : '🪙'}
                </span>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className={cn('font-medium text-xs', tokenInfo.color)}>
                    {stablecoin.symbol}
                  </div>
                  {stablecoin.chainInfo ? (
                    <div className="flex items-center gap-1">
                      <span className="text-lg">
                        {stablecoin.chainInfo.icon}
                      </span>
                      <div className={cn('text-xs', 'text-gray-400')}>
                        {stablecoin.chainInfo.name}
                      </div>
                    </div>
                  ) : (
                    <div className={cn('text-xs', 'text-gray-400')}>
                      {stablecoin.address.slice(0, 6)}...
                      {stablecoin.address.slice(-4)}
                    </div>
                  )}
                </div>
                <div className={cn('font-semibold text-sm', 'text-gray-900')}>
                  {parseFloat(stablecoin.formattedBalance).toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    },
                  )}{' '}
                  {stablecoin.symbol}
                </div>
              </div>

              {interactive && (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full border-2',
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300',
                    )}
                  >
                    {isSelected && (
                      <div className="h-full w-full rounded-full bg-blue-500"></div>
                    )}
                  </div>
                </div>
              )}
            </ItemComponent>
          )
        })}
      </div>
    </div>
  )
}
