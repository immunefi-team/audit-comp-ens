import type { JSX, SVGProps } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { cn } from '@/lib/utils'

// The minimal token shape this list renders: an icon/symbol, a balance, and a
// total price to compare against it. Broader token models (e.g.
// TokenWithPriceAndBalance) are structurally assignable, so both the register
// and renewal pickers can reuse this list without carrying extra fields.
export type PaymentTokenDisplay = {
  readonly symbol: string
  readonly address: Address
  readonly decimals: number
  readonly Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element
  readonly balance: bigint
  readonly price: { readonly total: bigint }
}

type PaymentTokenListProps<T extends PaymentTokenDisplay> = {
  readonly tokenData: readonly T[]
  readonly selectedToken: Address | null
  readonly isRegistering: boolean
  readonly onSelect: (token: T) => void
}

export const PaymentTokenList = <T extends PaymentTokenDisplay>({
  tokenData,
  selectedToken,
  isRegistering,
  onSelect,
}: PaymentTokenListProps<T>) => (
  <div className="space-y-2">
    {tokenData.map((token) => {
      const hasSufficientBalance = token.balance >= token.price.total

      return (
        <button
          key={token.symbol}
          type="button"
          onClick={() => onSelect(token)}
          disabled={!hasSufficientBalance || isRegistering}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between rounded-sm border-border border p-4 text-left transition-colors',
            selectedToken === token.address ? 'bg-muted' : 'hover:bg-muted/30',
            !hasSufficientBalance && 'cursor-not-allowed opacity-60',
          )}
        >
          <div className="flex items-center gap-1">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
              <token.Icon className="size-8 min-w-0 shrink-0" />
            </div>
            <p className="font-medium">{token.symbol}</p>
          </div>
          <div className="text-right">
            <p className="font-normal">
              {Number(
                formatUnits(token.balance, token.decimals),
              ).toLocaleString()}
            </p>
            {hasSufficientBalance ? (
              <p className="text-muted-foreground text-xs">available</p>
            ) : (
              <p className="text-destructive text-xs">Insufficient balance</p>
            )}
          </div>
        </button>
      )
    })}
  </div>
)
