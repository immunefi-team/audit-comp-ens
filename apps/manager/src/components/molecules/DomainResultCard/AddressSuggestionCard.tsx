import { Link } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import type { Address } from 'viem'
import { cn } from '@/lib/utils'

export type AddressSuggestionCardVariant = 'compact' | 'card'

export interface AddressSuggestionCardProps {
  readonly address: string
  readonly variant?: AddressSuggestionCardVariant
  readonly onClick?: () => void
}

export const AddressSuggestionCard = ({
  address,
  variant = 'card',
  onClick,
}: AddressSuggestionCardProps) => {
  const isCompact = variant === 'compact'

  return (
    <Link
      className={cn(
        'flex w-full items-center text-left transition',
        isCompact
          ? 'gap-3 px-3 py-2 hover:bg-slate-50'
          : 'domain-result-card cursor-pointer flex-col gap-3 rounded-sm bg-ens-white px-5 py-5 shadow-lg hover:-translate-y-0.5 hover:shadow-xl',
      )}
      onClick={onClick}
      params={{ address: address as Address }}
      to="/$address"
    >
      <div className={cn('flex w-full items-center gap-3')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-slate-100',
            isCompact ? 'size-8' : 'size-10',
          )}
        >
          <Wallet
            className={cn('text-slate-600', isCompact ? 'size-4' : 'size-5')}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {!isCompact && (
            <span className="font-sans text-muted-foreground text-sm">
              Address profile
            </span>
          )}
          <span
            className={cn(
              'min-w-0 font-medium text-foreground',
              isCompact
                ? 'truncate text-foreground text-sm'
                : 'break-words text-base',
            )}
          >
            {address}
          </span>
        </div>
      </div>
    </Link>
  )
}

AddressSuggestionCard.displayName = 'AddressSuggestionCard'
