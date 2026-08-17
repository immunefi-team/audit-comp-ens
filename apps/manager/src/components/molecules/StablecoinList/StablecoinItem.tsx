import { cn } from '@/lib/utils'

export interface StablecoinItemData {
  address: string
  symbol: string
  formattedBalance: string
}

interface StablecoinItemProps {
  stablecoin: StablecoinItemData
  isSelected?: boolean
  selectable?: boolean
  onClick?: (stablecoin: StablecoinItemData) => void
  className?: string
}

export const StablecoinItem = ({
  stablecoin,
  isSelected = false,
  selectable = false,
  onClick,
  className,
}: StablecoinItemProps) => {
  const handleClick = () => {
    if (selectable && onClick) {
      onClick(stablecoin)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (selectable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      handleClick()
    }
  }

  const Component = selectable ? 'button' : 'div'
  const componentProps = selectable
    ? {
        type: 'button' as const,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        tabIndex: 0,
      }
    : {}

  return (
    <Component
      className={cn(
        'flex w-full items-center justify-between rounded-md border p-2 transition-all duration-200',
        selectable && 'cursor-pointer hover:bg-muted/50',
        isSelected && 'bg-blue-50 ring-2 ring-blue-500',
        className,
      )}
      {...componentProps}
    >
      <span className="text-sm">{stablecoin.symbol}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">
          {stablecoin.formattedBalance}
        </span>
        {selectable && (
          <div
            className={cn(
              'h-3 w-3 rounded-full border-2 transition-colors',
              isSelected
                ? 'border-blue-500 bg-blue-500'
                : 'border-muted-foreground/30',
            )}
          />
        )}
      </div>
    </Component>
  )
}
