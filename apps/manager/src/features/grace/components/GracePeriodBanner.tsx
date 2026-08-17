import { Plural, Trans } from '@lingui/react/macro'
import { match } from 'ts-pattern'
import { LinkButton } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import { formatDashboardDate } from '@/features/dashboard/utils'
import { GracePeriodFavoriteButton } from '@/features/grace/components/GracePeriodFavoriteButton'
import { V2_GRACE_PERIOD_DAYS } from '@/features/grace/utils/gracePeriod'
import {
  getRenewalRoute,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'

export type GracePeriodBannerVariant =
  | 'primaryExpired'
  | 'anyNameExpired'
  | 'profileOwnName'
  | 'profileNotOwnedName'

type GracePeriodBannerProps = {
  readonly variant: GracePeriodBannerVariant
  readonly graceEndDate: Date
  readonly renewName: string
  readonly daysSinceExpiry?: number | null
  readonly isV2?: boolean
  readonly renewProtocol?: RenewalProtocol
  /** Storybook / previews: render Renew without TanStack Router */
  readonly previewRenew?: boolean
}

const gracePeriodActionClassName =
  'flex h-14 w-full items-center justify-center gap-2 rounded-xs border border-ens-citrine-600 bg-transparent px-3 py-4 font-mono text-ens-citrine-600 text-sm uppercase tracking-wide hover:bg-ens-citrine-600/5'

const bannerTitleClassName =
  'col-start-2 row-start-1 min-w-0 font-sans font-medium text-ens-citrine-600 text-xl leading-[110%] tracking-tight [leading-trim:both] [text-edge:cap]'

const bannerBodyClassName =
  'col-start-2 row-start-2 min-w-0 font-sans font-normal text-sm text-ens-citrine-500 leading-[120%] tracking-normal [leading-trim:both] [text-edge:cap]'

const bannerTitle = (variant: GracePeriodBannerVariant) =>
  match(variant)
    .with('primaryExpired', () => <Trans>Your primary name has expired.</Trans>)
    .with('anyNameExpired', () => <Trans>One of your names expired.</Trans>)
    .with('profileOwnName', () => <Trans>Your name is in grace period</Trans>)
    .with('profileNotOwnedName', () => (
      <Trans>This name is in grace period</Trans>
    ))
    .exhaustive()

const bannerBody = ({
  variant,
  daysSinceExpiry,
  graceDays,
  formattedGraceEnd,
}: {
  readonly variant: GracePeriodBannerVariant
  readonly daysSinceExpiry: number | null
  readonly graceDays: number
  readonly formattedGraceEnd: string
}) =>
  variant === 'profileNotOwnedName' ? (
    <Trans>
      This name expired and can still be renewed by its previous owner until{' '}
      <span className="font-semibold">{formattedGraceEnd}</span>. If renewed, it
      stays with the previous owner. After grace ends, it enters temporary
      premium and anyone can register it.
    </Trans>
  ) : variant === 'primaryExpired' && daysSinceExpiry != null ? (
    <Trans>
      Your primary name expired{' '}
      <Plural one="# day" other="# days" value={daysSinceExpiry} /> ago and is
      now in its {graceDays}-day grace period. Renew by{' '}
      <span className="font-semibold">{formattedGraceEnd}</span> to keep it.
      While in grace, the name won&apos;t work with its records.
    </Trans>
  ) : (
    <Trans>
      Your expired name is now in its {graceDays}-day grace period. Renew by{' '}
      <span className="font-semibold">{formattedGraceEnd}</span> to keep it.
      While in grace, the name won&apos;t work with its records.
    </Trans>
  )

export const GracePeriodBanner = ({
  variant,
  graceEndDate,
  renewName,
  daysSinceExpiry = null,
  isV2 = true,
  renewProtocol = 'v2',
  previewRenew = false,
}: GracePeriodBannerProps) => {
  const formattedGraceEnd = formatDashboardDate(graceEndDate)
  const graceDays = isV2 ? V2_GRACE_PERIOD_DAYS : 90
  const isNotOwnedProfile = variant === 'profileNotOwnedName'

  return (
    <div className="@container w-full rounded-xs border border-ens-citrine-300 bg-ens-citrine-100 p-4">
      <div className="flex w-full @md:flex-row flex-col @md:items-center @md:justify-between @md:gap-6 gap-4">
        <div className="grid w-full min-w-0 @md:flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-2">
          <MSymbol
            className="col-start-1 row-span-2 row-start-1 ms-opsz-20 ms-wght-400 self-start text-ens-citrine-500"
            symbol="calendar_month"
          />
          <p className={bannerTitleClassName}>{bannerTitle(variant)}</p>
          <p className={bannerBodyClassName}>
            {bannerBody({
              daysSinceExpiry,
              formattedGraceEnd,
              graceDays,
              variant,
            })}
          </p>
        </div>
        <div className="@md:w-[298px] w-full shrink-0">
          {previewRenew ? (
            <span className={gracePeriodActionClassName}>
              {isNotOwnedProfile ? (
                <Trans>Add to favorites</Trans>
              ) : (
                <Trans>Renew</Trans>
              )}
            </span>
          ) : isNotOwnedProfile ? (
            <GracePeriodFavoriteButton
              className={gracePeriodActionClassName}
              name={renewName}
            />
          ) : (
            <LinkButton
              className={gracePeriodActionClassName}
              params={{ name: renewName }}
              to={getRenewalRoute(renewProtocol)}
              variant="outline"
            >
              <Trans>Renew</Trans>
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  )
}
