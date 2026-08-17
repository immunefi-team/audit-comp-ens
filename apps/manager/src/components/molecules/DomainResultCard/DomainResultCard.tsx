import { Trans } from '@lingui/react/macro'
import { AvailabilityCheckIcon } from '@/components/atoms/AvailabilityCheckIcon'
import { GracePeriodBadge } from '@/features/grace/components/GracePeriodBadge'
import type { PremiumLabel } from '@/features/shared/registration/nameUtils'
import { cn } from '@/lib/utils'
import { getByteLength, getDomainCardSizeClasses } from '@/utils/domain'
import { DomainAttributePill } from './DomainAttributePill'
import {
  type DomainResultStatus,
  isRegisteredDomainResultStatus,
} from './domainResultStatus'

export type DomainResultCardProps = {
  domainName: string
  status: DomainResultStatus
  premiumLabel?: PremiumLabel
  price?: number
  priceLabel?: string
  className?: string
  isLoading?: boolean
  clickable?: boolean
  /** Renders the "Price Cooldown" pill when the name is in temp premium. */
  isInCooldown?: boolean
}

const statusIconMap = {
  available: <AvailabilityCheckIcon />,
  premium: <AvailabilityCheckIcon />,
} as const

export const DomainResultCard = ({
  domainName,
  status,
  premiumLabel,
  price,
  priceLabel = '/year',
  className,
  isLoading = false,
  clickable = false,
  isInCooldown = false,
}: DomainResultCardProps) => {
  const baseClasses = cn(
    'domain-result-card',
    'flex w-full flex-col',
    'gap-3',
    'px-5 py-5',
    'text-left',
    'bg-ens-white',
    'rounded-sm',
    'shadow-lg transition',
    clickable && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl',
    className,
  )

  const content = (
    <div className="flex w-full flex-col gap-3">
      {isLoading ? (
        <>
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-[9px]">
              <span className="flex h-[26px] w-6.5 animate-pulse items-center justify-center rounded-full bg-slate-200" />
              <span className="inline-block h-9 w-48 animate-pulse rounded-sm bg-slate-200" />
            </div>

            <div className="flex items-end gap-2 text-center">
              <span className="inline-block h-5 w-20 animate-pulse rounded-md bg-slate-200 leading-tight" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-8.5">
            <span className="inline-block h-6 w-20 animate-pulse rounded-full bg-slate-200" />
            <span className="inline-block h-6 w-32 animate-pulse rounded-full bg-slate-200" />
          </div>
        </>
      ) : isRegisteredDomainResultStatus(status) ? (
        <>
          <span
            className={cn(
              'inline-block w-fit max-w-full break-words rounded-sm border border-ens-blue bg-white px-2 py-1',
              'font-medium text-ens-blue leading-tight tracking-[-0.48px]',
              getDomainCardSizeClasses(getByteLength(domainName)),
            )}
            title={domainName}
          >
            {domainName}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 shrink-0 items-center justify-center rounded-xl bg-ens-white px-2 py-1 font-sans text-ens-lapis-core text-xs leading-none">
              <Trans>Registered</Trans>
            </span>
            {status === 'grace' && <GracePeriodBadge />}
          </div>
        </>
      ) : (
        <>
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-[9px]">
              <span className="flex shrink-0 items-center justify-center pt-0.5">
                {statusIconMap[status]}
              </span>
              <span
                className={cn(
                  'px-2 py-1',
                  'text-ens-blue',
                  'bg-white',
                  'border border-ens-blue',
                  'font-medium leading-tight tracking-[-0.48px]',
                  'block min-w-0 break-words rounded-sm',
                  getDomainCardSizeClasses(getByteLength(domainName)),
                )}
                title={domainName}
              >
                {domainName}
              </span>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2 text-right">
              <span className="text-slate-500 text-sm">starting at</span>
              <div className="flex flex-col items-end text-sm md:flex-row md:items-end md:gap-2 md:text-base">
                {price ? (
                  <>
                    <p className="font-semibold text-slate-900 leading-tight">
                      ${Math.round(price).toLocaleString()}
                    </p>
                    <p className="text-slate-500 text-sm">{priceLabel}</p>
                  </>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="inline-block h-5 w-20 animate-pulse rounded-md bg-slate-200 leading-tight" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-8.5">
            <DomainAttributePill label="available" variant="available" />
            {premiumLabel && (
              <DomainAttributePill
                label={premiumLabel.label}
                variant={premiumLabel.variant}
              />
            )}
            {isInCooldown && (
              <DomainAttributePill label="Price Cooldown" variant="cooldown" />
            )}
          </div>
        </>
      )}
    </div>
  )

  return <div className={baseClasses}>{content}</div>
}

DomainResultCard.displayName = 'DomainResultCard'
