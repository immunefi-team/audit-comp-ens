import { Trans } from '@lingui/react/macro'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { cn } from '@/lib/utils'

export interface DomainProfileCardProps {
  readonly domainName: string
  readonly avatarUrl?: string | null
  readonly registeredDate?: Date | string | null
  readonly expiryDate?: Date | string | null
  readonly className?: string
  readonly clickable?: boolean
  readonly themeColor?: string | null
}

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) return ''

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const DomainProfileCard = ({
  domainName,
  avatarUrl,
  registeredDate,
  expiryDate,
  className,
  clickable = false,
  themeColor,
}: DomainProfileCardProps) => {
  const formattedRegisteredDate = formatDate(registeredDate) || 'N/A'
  const formattedExpiryDate = formatDate(expiryDate) || 'N/A'
  const themeVars = getThemeVars(themeColor)

  return (
    <div
      className={cn(
        'flex h-[157px] w-full items-end justify-between gap-4',
        'rounded-sm bg-ens-white p-[22px]',
        'shadow-[0px_4px_6px_-1px_rgba(14,61,104,0.06),0px_20.905px_27.874px_0px_rgba(14,61,104,0.10)] transition',
        clickable &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(14,61,104,0.08),0px_20px_28px_-12px_rgba(15,23,42,0.24)]',
        className,
      )}
      style={themeVars as React.CSSProperties}
    >
      {/* Left section: Avatar and Domain Info */}
      <div className="flex h-full items-center gap-4">
        {/* Avatar */}
        <div className="relative size-[113px] shrink-0">
          <div className="size-[113px] overflow-clip rounded-[5.215px] bg-ens-white">
            <ImageFallback.Root className="contents">
              <ImageFallback.Image
                alt={`${domainName} avatar`}
                className="size-full object-cover"
                src={avatarUrl ?? undefined}
              />
              <ImageFallback.Fallback>
                <PatternAvatar
                  className="size-full rounded-[5.215px] border-none bg-transparent p-0 shadow-none"
                  color={themeVars['--theme-color']}
                  name={domainName}
                />
              </ImageFallback.Fallback>
            </ImageFallback.Root>
          </div>
        </div>

        {/* Domain Info */}
        <div className="flex h-full flex-col justify-start gap-2">
          {/* Domain Name Badge */}
          <div className="flex w-fit items-center justify-center gap-[10px] rounded-sm bg-(--theme-color) px-2 py-1 font-medium text-2xl text-ens-white leading-none tracking-[-0.64px]">
            {domainName}
          </div>

          {/* Registration and Expiry Info */}
          <div className="flex flex-col gap-2">
            {/* Registered Date */}
            {formattedRegisteredDate && (
              <div className="flex items-center gap-[5.417px]">
                <Calendar className="size-5 text-(--theme-surface)" />
                <div className="flex items-end gap-[3.611px]">
                  <p className="text-(--theme-surface) text-sm leading-none tracking-[-0.28px]">
                    <Trans>Registered</Trans>
                  </p>
                  <p className="whitespace-nowrap font-medium text-(--theme-color) text-sm leading-none tracking-[-0.28px]">
                    {formattedRegisteredDate}
                  </p>
                </div>
              </div>
            )}

            {/* Expiry Date */}
            {formattedExpiryDate && (
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-(--theme-surface)" />
                <div className="flex items-center gap-1">
                  <p className="text-(--theme-surface) text-sm leading-none tracking-[-0.28px]">
                    <Trans>Expires</Trans>
                  </p>
                  <p className="whitespace-nowrap font-medium text-(--theme-color) text-sm leading-none tracking-[-0.28px]">
                    {formattedExpiryDate}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="group flex h-8 min-w-[101px] shrink-0 flex-col items-end justify-end rounded-sm border border-(--theme-color)">
        <div className="flex h-8 items-center gap-1 rounded-sm px-2 py-1">
          <p className="text-center font-medium text-(--theme-color) text-xs leading-normal">
            View profile
          </p>
          <ArrowRight className="size-2.5 text-(--theme-color)" />
        </div>
      </div>
    </div>
  )
}

DomainProfileCard.displayName = 'DomainProfileCard'
