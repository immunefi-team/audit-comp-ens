import { ChevronDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  type CoinConfig,
  getCoinByName,
  SUPPORTED_COINS,
} from '@/lib/constants/coins'
import { cn } from '@/lib/utils'

type CoinSelectProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function CoinSelect({
  value,
  onChange,
  placeholder = 'Select coin...',
  className,
}: CoinSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedCoin = getCoinByName(value)

  const filteredCoins = useMemo(() => {
    if (!search) return SUPPORTED_COINS

    const searchLower = search.toLowerCase()
    return SUPPORTED_COINS.filter(
      (coin) =>
        coin.name.toLowerCase().includes(searchLower) ||
        coin.longName.toLowerCase().includes(searchLower),
    )
  }, [search])

  const handleSelect = (coin: CoinConfig) => {
    onChange(coin.name.toUpperCase())
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selectedCoin ? (
            <span className="flex items-center gap-2">
              {selectedCoin.icon && (
                <img
                  src={selectedCoin.icon}
                  alt={selectedCoin.name}
                  className="h-5 w-5"
                />
              )}
              <span>{selectedCoin.name.toUpperCase()}</span>
              <span className="text-muted-foreground">
                ({selectedCoin.longName})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search coins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredCoins.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No coins found.
            </div>
          ) : (
            filteredCoins.map((coin) => (
              <button
                key={coin.name}
                type="button"
                onClick={() => handleSelect(coin)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:bg-accent focus:text-accent-foreground',
                  selectedCoin?.name === coin.name && 'bg-accent',
                )}
              >
                {coin.icon ? (
                  <img src={coin.icon} alt={coin.name} className="h-5 w-5" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted" />
                )}
                <span className="font-medium">{coin.name.toUpperCase()}</span>
                <span className="text-muted-foreground">({coin.longName})</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
