import { Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ClassifiedName } from '../service/classifyNames'
import { getMigrationAvatarUrl } from './nameAvatar.helpers'

type NameRowProps = {
  readonly item: ClassifiedName
  readonly isSelected: boolean
  readonly indent: boolean
  readonly interactive: boolean
  readonly firstSubname?: boolean
  readonly onClick?: () => void
}

export const NameRow = ({
  item,
  isSelected,
  indent,
  interactive,
  firstSubname = false,
  onClick,
}: NameRowProps) => {
  const isSubname = indent && !interactive
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const avatarUrl = getMigrationAvatarUrl(item.domain.name)
  const showAvatar = failedAvatarUrl !== avatarUrl

  const content = (
    <>
      {isSubname ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-1/2 left-14.5 z-0 w-7.5 rounded-bl-md border-ens-garnet-900/30 border-b border-l',
            firstSubname ? '-top-4' : '-top-10.25',
          )}
        />
      ) : (
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border p-1 transition-colors',
            isSelected
              ? 'border-ens-garnet-900 bg-ens-garnet-900'
              : 'border-ens-garnet-900/30 bg-transparent',
          )}
        >
          <Check
            className={cn(
              'size-5 transition-opacity',
              isSelected
                ? 'text-white opacity-100'
                : 'text-transparent opacity-0',
            )}
            strokeWidth={2.5}
          />
        </div>
      )}
      <div className="relative z-10 flex size-9.25 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-ens-garnet-900/10">
        <span className="font-semi-mono text-ens-garnet-900 text-xs">
          {item.domain.labelName?.[0]?.toUpperCase() ?? '?'}
        </span>
        {showAvatar && (
          <img
            alt=""
            aria-hidden
            className="absolute inset-0 size-full rounded-sm object-cover"
            onError={() => setFailedAvatarUrl(avatarUrl)}
            src={avatarUrl}
          />
        )}
      </div>
      <div
        className={cn(
          'flex h-9.25 items-center rounded-xs border bg-white px-2 py-1 font-medium font-semi-mono text-base leading-[0.96] tracking-[-0.32px] md:text-[20px] md:tracking-[-0.4px]',
          isSelected
            ? 'border-ens-quartz-500/40 text-ens-quartz-500'
            : 'border-ens-lapis-500 text-ens-lapis-500',
        )}
      >
        {item.domain.name}
      </div>
    </>
  )

  const rowClass = cn(
    'relative flex items-center gap-3 outline-none focus-visible:[&>div:first-child]:ring-2 focus-visible:[&>div:first-child]:ring-ens-lapis-500/40 focus-visible:[&>div:first-child]:ring-offset-2',
    isSubname && 'pl-22',
    interactive ? 'cursor-pointer' : 'cursor-default',
  )

  if (interactive) {
    return (
      <button
        aria-pressed={isSelected}
        className={rowClass}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    )
  }

  return <div className={rowClass}>{content}</div>
}
