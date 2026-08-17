import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronDown, History } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { LinkButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  formatDashboardDate,
  NON_EXPIRING_DATE_LABEL,
} from '@/features/dashboard/utils'
import {
  getProfileExpiryResultStatus,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import { profileRegistrationQuery } from '@/features/profile/service/profileRegistration'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { cn } from '@/lib/utils'
import { ChoosePrimaryNameDialog } from './ChoosePrimaryNameDialog'
import { PrimaryBadge } from './PrimaryBadge'

type PrimaryNameCardProps = {
  readonly primaryName?: string | null
  readonly avatarUrl?: string | null
  readonly themeColor?: string | null
}

const PrimaryNameNameplate = ({
  isInGrace,
  displayName,
}: {
  readonly isInGrace: boolean
  readonly displayName: string
}) => {
  const isLongName = displayName.length > 10

  return (
    <div
      className={
        isInGrace
          ? 'inline-flex items-center rounded-sm border border-border bg-transparent px-2 py-1 md:px-[8.5px] md:py-[4.25px]'
          : 'inline-flex items-center rounded-sm bg-(--theme-color) px-2 py-1 md:px-[8.5px] md:py-[4.25px]'
      }
    >
      <span
        className={
          isInGrace
            ? 'font-medium font-mono text-foreground text-xl leading-ens-none tracking-tight md:text-3xl'
            : isLongName
              ? 'font-medium font-semi-mono text-2xl text-ens-white leading-[0.96] tracking-tight'
              : 'font-medium font-semi-mono text-ens-white text-xl leading-[0.96] tracking-tight md:text-[28px]'
        }
      >
        {displayName}
      </span>
    </div>
  )
}

const getExpiryLabel = (params: {
  readonly displayExpiryDate: Date | null
  readonly isLoading: boolean
  readonly isNonExpiring?: boolean
  readonly loadingLabel: string
}) => {
  if (params.isLoading) return params.loadingLabel
  if (params.isNonExpiring) return NON_EXPIRING_DATE_LABEL
  return formatDashboardDate(params.displayExpiryDate)
}

export const PrimaryNameCard = ({
  primaryName,
  avatarUrl,
  themeColor,
}: PrimaryNameCardProps) => {
  const { t } = useLingui()
  const shouldReduceMotion = useReducedMotion()

  const { data: registration, isLoading: isRegistrationLoading } = useQuery({
    ...profileRegistrationQuery(primaryName ?? ''),
    enabled: !!primaryName,
  })

  const { data: reverseExpiry, isLoading: isReverseExpiryLoading } = useQuery({
    ...profileExpiryQuery(primaryName ?? ''),
    enabled: !!primaryName,
  })
  const { isInGrace, displayExpiryDate } =
    getProfileExpiryResultStatus(reverseExpiry)

  const registeredDate =
    registration?.registrationDate == null
      ? null
      : new Date(registration.registrationDate * 1000)
  const hasAvatar = Boolean(avatarUrl) && !isInGrace
  const displayName = primaryName ?? t`Your ENS name`
  const registeredLabel = isRegistrationLoading
    ? t`Loading...`
    : formatDashboardDate(registeredDate)
  const expiryLabel = getExpiryLabel({
    displayExpiryDate,
    isLoading: isReverseExpiryLoading,
    isNonExpiring: reverseExpiry?.isNonExpiring,
    loadingLabel: t`Loading...`,
  })
  const canViewProfile = Boolean(primaryName)

  const themeVars = getThemeVars(themeColor)
  const profileThemeColor = isInGrace ? undefined : themeVars['--theme-color']

  return (
    <Card
      className={cn(
        'flex flex-col gap-4 rounded-none border-[0.25px] border-border bg-white p-4 shadow-none md:rounded-xl md:p-6',
        isInGrace && 'opacity-70',
      )}
      style={isInGrace ? undefined : (themeVars as React.CSSProperties)}
    >
      <PrimaryBadge className="self-start bg-ens-lapis-tint" />

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="flex flex-row items-start gap-4 md:gap-5">
          <motion.div
            className="size-20 shrink-0 overflow-hidden rounded-sm bg-ens-white md:size-50"
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.95 },
                  animate: { opacity: 1, scale: 1 },
                  transition: {
                    duration: 0.25,
                    ease: [0.25, 0.46, 0.45, 0.94] as const,
                  },
                })}
          >
            <ImageFallback.Root className="contents">
              <ImageFallback.Image
                alt={displayName}
                className="size-20 object-cover md:size-full"
                src={hasAvatar ? (avatarUrl as string) : undefined}
              />
              <ImageFallback.Fallback>
                <PatternAvatar
                  className="size-20 rounded-sm border-none bg-transparent p-0 shadow-none md:size-full"
                  color={profileThemeColor}
                  name={primaryName ?? ''}
                />
              </ImageFallback.Fallback>
            </ImageFallback.Root>
          </motion.div>
          <div className="flex min-h-0 flex-col justify-between gap-4 md:h-50">
            <ChoosePrimaryNameDialog>
              <button
                className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
                type="button"
              >
                <PrimaryNameNameplate
                  displayName={displayName}
                  isInGrace={isInGrace}
                />
                <ChevronDown
                  className="size-6 shrink-0 text-ens-quartz-400"
                  strokeWidth={2}
                />
              </button>
            </ChoosePrimaryNameDialog>
            <div className="flex flex-col gap-[8.5px]">
              <div className="flex items-center gap-2">
                <Calendar
                  className="size-5 text-ens-quartz-400"
                  strokeWidth={1.5}
                />
                <div className="flex items-center gap-1.5 text-base leading-normal">
                  <span className="text-ens-quartz-400">
                    <Trans>Registered</Trans>
                  </span>
                  <span className="text-ens-quartz-700">{registeredLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <History
                  className="size-5 text-ens-quartz-400"
                  strokeWidth={1.5}
                />
                <div className="flex items-center gap-1.5 text-base leading-normal">
                  <span className="text-ens-quartz-400">
                    <Trans>Expires</Trans>
                  </span>
                  <span className="text-ens-quartz-700">{expiryLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <LinkButton
          className="group flex h-auto w-full items-center justify-center gap-1.5 bg-transparent p-0 font-mono text-(--theme-color) uppercase tracking-wider hover:bg-transparent hover:text-(--theme-color) hover:no-underline hover:opacity-80 md:w-auto"
          disabled={!canViewProfile}
          params={{ name: primaryName ?? '' }}
          to="/$name"
          variant="link"
        >
          <span className="font-mono text-base leading-normal underline-offset-4 group-hover:underline">
            <Trans>Go to profile</Trans>
          </span>
          <MSymbol className="ms-opsz-20 text-base" symbol="arrow_forward" />
        </LinkButton>
      </div>
    </Card>
  )
}
