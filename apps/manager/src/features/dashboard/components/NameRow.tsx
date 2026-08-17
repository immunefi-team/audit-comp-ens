import { useMediaQuery } from '@ens-apps/utils/useMediaQuery'
import { useLingui as useCoreLingui } from '@lingui/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { ArrowRight, Check, Heart, History } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EXPLORER_URL } from '@/constants'
import { NON_EXPIRING_DATE_LABEL } from '@/features/dashboard/utils'
import { GracePeriodBadge } from '@/features/grace/components/GracePeriodBadge'
import {
  favoriteAuthPromptMessage,
  getFavoriteActionDisabled,
  getFavoriteActionIntent,
} from '@/features/profile/components/common/favoriteAction.helpers'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import {
  getRenewalRoute,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'
import { cn } from '@/lib/utils'
import {
  EligibleForUpgradePill,
  Ensv1OnlyPill,
  ExpiringPill,
  type NameRole,
  RolePill,
} from './DashboardPills'

export type NameStatus = 'eligibleUpgrade' | 'ensv1Only'
export type NameRowCta = 'renew' | 'remindMe' | 'manageExplorer'

interface NameRowProps {
  readonly label: string
  readonly avatarUrl?: string
  readonly avatarPending?: boolean
  readonly themeColor?: string | null
  readonly nameVariant?: 'primary' | 'secondary'
  readonly verified?: boolean
  readonly nameRole?: NameRole | null
  readonly nameRoles?: readonly NameRole[] | null
  readonly status?: NameStatus | null
  readonly expiringInDays?: number | null
  readonly expiryLabel?: string | null
  readonly cta?: NameRowCta | null
  readonly isFavorite?: boolean
  readonly showFavoriteButton?: boolean
  readonly onToggleFavorite?: () => void
  readonly isAuthenticated?: boolean
  readonly isInGrace?: boolean
  readonly canRenew?: boolean
  readonly selectable?: boolean
  readonly isSelected?: boolean
  readonly onToggleSelect?: () => void
  readonly renewalProtocol?: RenewalProtocol
}

const explorerUrl = (label: string) => `${EXPLORER_URL}/${label}`

const namePillVariants = cva(
  'inline-flex max-w-full items-center gap-2 rounded-sm px-1.5 py-1.75',
  {
    variants: {
      variant: {
        primary: 'bg-ens-lapis-core text-ens-lapis-bg',
        secondary: 'bg-ens-quartz-200 text-ens-quartz-450',
      },
    },
  },
)

const NamePill = ({
  label,
  variant,
  selected = false,
}: {
  readonly label: string
  readonly variant: 'primary' | 'secondary'
  readonly selected?: boolean
}) => {
  const className = cn(
    namePillVariants({ variant }),
    selected && 'bg-ens-lapis-core text-ens-quartz-0',
  )
  const textClassName =
    'min-w-0 break-all font-medium font-semi-mono text-base leading-none tracking-[-0.32px] [text-wrap:pretty]'

  const inner = (
    <>
      <span className={textClassName}>{label}</span>
      <ArrowRight className="size-5 shrink-0" strokeWidth={2} />
    </>
  )

  return (
    <Link className={className} params={{ name: label }} to="/$name">
      {inner}
    </Link>
  )
}

const VerifiedCheck = () => (
  <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-ens-lapis-500">
    <Check className="size-[9px] text-white" strokeWidth={4} />
  </span>
)

const SelectedCheck = () => (
  <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-ens-lapis-core">
    <Check className="size-3.5 text-ens-quartz-0" strokeWidth={3} />
  </span>
)

const ctaVariants = cva(
  'flex items-center gap-1.5 font-normal font-semi-mono text-base uppercase leading-none tracking-[-0.16px] hover:opacity-80',
  {
    variants: {
      kind: {
        renew: 'text-ens-lapis-core',
        remindMe: 'text-ens-lapis-900',
        manageExplorer: 'text-ens-garnet-500',
      },
    },
  },
)

const RowCta = ({
  cta,
  label,
  renewalProtocol,
}: {
  readonly cta: NameRowCta
  readonly label: string
  readonly renewalProtocol: RenewalProtocol
}) => {
  if (cta === 'manageExplorer') {
    return (
      <a
        className={ctaVariants({ kind: 'manageExplorer' })}
        href={explorerUrl(label)}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Trans>Manage on explorer</Trans>
        <MSymbol className="ms-opsz-20 text-xl" symbol="arrow_outward" />
      </a>
    )
  }

  if (cta === 'remindMe') {
    return (
      <Link
        className={ctaVariants({ kind: 'remindMe' })}
        to="/notifications/settings"
      >
        <Trans>Remind me</Trans>
        <MSymbol
          className="ms-opsz-20 text-xl"
          symbol="notification_settings"
        />
      </Link>
    )
  }

  return (
    <Link
      className={ctaVariants({ kind: 'renew' })}
      params={{ name: label }}
      to={getRenewalRoute(renewalProtocol)}
    >
      <Trans>Renew</Trans>
      <MSymbol className="ms-opsz-20 text-xl" symbol="double_arrow" />
    </Link>
  )
}

const FavoriteButton = ({
  isFavorite,
  isAuthenticated,
  isDisabled,
  onToggleFavorite,
}: {
  readonly isFavorite: boolean
  readonly isAuthenticated: boolean
  readonly isDisabled: boolean
  readonly onToggleFavorite?: () => void
}) => {
  const { t } = useLingui()

  return (
    <motion.button
      aria-disabled={isDisabled}
      aria-label={isFavorite ? t`Remove favorite` : t`Add favorite`}
      aria-pressed={isFavorite}
      className="flex shrink-0 items-center justify-center disabled:cursor-not-allowed"
      disabled={isDisabled}
      onClick={onToggleFavorite}
      transition={{ duration: 0.1 }}
      type="button"
      whileTap={isAuthenticated && !isDisabled ? { scale: 0.8 } : undefined}
    >
      <Heart
        className={cn(
          'size-6.5',
          isFavorite
            ? 'fill-ens-magenta text-ens-magenta'
            : 'text-ens-quartz-250',
          !isAuthenticated && 'opacity-50',
        )}
        strokeWidth={2}
      />
    </motion.button>
  )
}

const FavoriteControl = ({
  label,
  showFavoriteButton,
  isAuthenticated,
  isFavorite,
  onToggleFavorite,
}: Pick<
  NameRowProps,
  | 'label'
  | 'showFavoriteButton'
  | 'isAuthenticated'
  | 'isFavorite'
  | 'onToggleFavorite'
>) => {
  const { _ } = useCoreLingui()
  const shouldPromptAuth = useMediaQuery('(max-width: 767px)')

  if (!showFavoriteButton) return null

  const isAuthed = isAuthenticated ?? true
  const favorite = isFavorite ?? false
  const isDisabled = getFavoriteActionDisabled({ isPending: false })
  const authPrompt = _(favoriteAuthPromptMessage)

  const handleToggleFavorite = () => {
    const intent = getFavoriteActionIntent({
      isAuthed,
      isFavorite: favorite,
      isPending: false,
      name: label,
      shouldPromptAuth,
    })

    switch (intent.kind) {
      case 'addFavorite':
      case 'removeFavorite':
        onToggleFavorite?.()
        return
      case 'promptAuth':
        toast(authPrompt, { id: 'favorite-auth-prompt' })
        return
      case 'none':
        return
    }
  }

  const button = (
    <FavoriteButton
      isAuthenticated={isAuthed}
      isDisabled={isDisabled}
      isFavorite={favorite}
      onToggleFavorite={handleToggleFavorite}
    />
  )

  if (isAuthed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{authPrompt}</TooltipContent>
    </Tooltip>
  )
}

const NameRowTop = ({
  status,
  nameRoles,
  isInGrace,
  expiringInDays,
}: Pick<NameRowProps, 'status' | 'isInGrace' | 'expiringInDays'> & {
  readonly nameRoles: readonly NameRole[]
}) => {
  const hasTopRow = Boolean(
    isInGrace || status || nameRoles.length > 0 || expiringInDays,
  )
  if (!hasTopRow) return null

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'eligibleUpgrade' && <EligibleForUpgradePill />}
        {status === 'ensv1Only' && <Ensv1OnlyPill />}
        {nameRoles.map((role) => (
          <RolePill key={role} role={role} />
        ))}
      </div>
      {isInGrace ? (
        <GracePeriodBadge />
      ) : expiringInDays !== null &&
        expiringInDays !== undefined &&
        expiringInDays > 0 ? (
        <ExpiringPill days={expiringInDays} />
      ) : (
        <span />
      )}
    </div>
  )
}

const getNameRoles = ({
  nameRole,
  nameRoles,
}: Pick<NameRowProps, 'nameRole' | 'nameRoles'>): readonly NameRole[] => {
  const roles = nameRoles ?? (nameRole ? [nameRole] : [])
  return Array.from(new Set(roles))
}

const NameAvatar = ({
  label,
  avatarUrl,
  isPending,
  themeColor,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  readonly label: string
  readonly avatarUrl?: string
  readonly isPending?: boolean
  readonly themeColor?: string
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onToggleSelect?: () => void
}) => {
  const { t } = useLingui()

  if (isPending) {
    return (
      <div
        aria-hidden="true"
        className="relative size-8.5 shrink-0 animate-pulse overflow-hidden rounded-sm bg-gray-200"
      />
    )
  }

  const inner = (
    <>
      <ImageFallback.Root className="contents">
        <ImageFallback.Image
          alt={t`${label} avatar`}
          className="size-full object-cover"
          src={avatarUrl}
        />
        <ImageFallback.Fallback>
          <PatternAvatar
            className="size-full rounded-sm border-none bg-transparent p-0 shadow-none"
            color={themeColor}
            name={label}
          />
        </ImageFallback.Fallback>
      </ImageFallback.Root>
      {selected && (
        <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-ens-lapis-500/60">
          <Check className="size-5 text-ens-quartz-0" strokeWidth={3} />
        </div>
      )}
    </>
  )

  const containerClassName =
    'relative size-8.5 shrink-0 overflow-hidden rounded-sm bg-ens-quartz-50'

  if (selectable) {
    return (
      <button
        aria-label={selected ? t`Deselect ${label}` : t`Select ${label}`}
        aria-pressed={selected}
        className={containerClassName}
        onClick={onToggleSelect}
        type="button"
      >
        {inner}
      </button>
    )
  }

  return <div className={containerClassName}>{inner}</div>
}

const NameOptionsMenu = ({
  canRenew,
  label,
  renewalProtocol,
}: {
  readonly canRenew: boolean
  readonly label: string
  readonly renewalProtocol: RenewalProtocol
}) => {
  const { t } = useLingui()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t`More options for ${label}`}
          className="flex shrink-0 items-center justify-center text-ens-quartz-700 outline-none"
          type="button"
        >
          <MSymbol
            className="ms-opsz-20 ms-wght-300 text-[26px] leading-none md:text-[28px]"
            symbol="more_horiz"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-67 rounded-xl border-none bg-white p-4 shadow-[0px_4px_4px_rgba(200,200,200,0.25)]"
        sideOffset={10}
      >
        {canRenew && (
          <DropdownMenuItem asChild>
            <Link
              className="flex h-12 items-center justify-between rounded-[10px] bg-ens-quartz-50 px-4 py-3 font-semi-mono text-[14px] text-ens-quartz-900 uppercase focus:bg-ens-quartz-50 focus:text-ens-quartz-900"
              params={{ name: label }}
              to={getRenewalRoute(renewalProtocol)}
            >
              <Trans>Renew name</Trans>
              <MSymbol
                className="ms-opsz-20 text-xl leading-none"
                symbol="double_arrow"
              />
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link
            className="flex h-12 items-center justify-between rounded-[10px] px-4 py-3 font-semi-mono text-[14px] text-ens-lapis-900 uppercase focus:bg-transparent focus:text-ens-lapis-900"
            to="/notifications/settings"
          >
            <Trans>Manage notifications</Trans>
            <MSymbol
              className="ms-opsz-20 text-ens-quartz-900 text-xl leading-none"
              symbol="notification_settings"
            />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ExpiryDetails = ({
  expiryLabel,
  cta,
  label,
  renewalProtocol,
}: Pick<NameRowProps, 'expiryLabel' | 'cta' | 'label' | 'renewalProtocol'>) => {
  if (!expiryLabel && !cta) return null

  const isNonExpiring = expiryLabel === NON_EXPIRING_DATE_LABEL

  return (
    <div className="flex items-center justify-between gap-3">
      {expiryLabel ? (
        <div className="flex items-center gap-2">
          <History className="size-4 shrink-0 text-ens-quartz-360" />
          <span className="font-sans text-ens-quartz-380 text-sm">
            {isNonExpiring ? (
              <Trans>Does not expire</Trans>
            ) : (
              <Trans>Expires on</Trans>
            )}
          </span>
          {!isNonExpiring && (
            <span className="font-sans text-ens-quartz-550 text-sm">
              {expiryLabel}
            </span>
          )}
        </div>
      ) : (
        <span />
      )}
      {cta && (
        <RowCta
          cta={cta}
          label={label}
          renewalProtocol={renewalProtocol ?? 'v2'}
        />
      )}
    </div>
  )
}

export const NameRow = ({
  label,
  avatarUrl,
  avatarPending = false,
  themeColor,
  nameVariant = 'secondary',
  verified = false,
  nameRole = null,
  nameRoles = null,
  status = null,
  expiringInDays = null,
  expiryLabel = null,
  cta = null,
  isFavorite = false,
  showFavoriteButton = false,
  onToggleFavorite,
  isAuthenticated = true,
  isInGrace = false,
  canRenew = true,
  selectable = false,
  isSelected = false,
  onToggleSelect,
  renewalProtocol = 'v2',
}: NameRowProps) => {
  const themeVars =
    themeColor && !isInGrace ? getThemeVars(themeColor) : undefined
  const resolvedThemeColor = themeVars?.['--theme-color']
  const resolvedNameRoles = getNameRoles({ nameRole, nameRoles })

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <NameRowTop
        expiringInDays={expiringInDays}
        isInGrace={isInGrace}
        nameRoles={resolvedNameRoles}
        status={status}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <FavoriteControl
            isAuthenticated={isAuthenticated}
            isFavorite={isFavorite}
            label={label}
            onToggleFavorite={onToggleFavorite}
            showFavoriteButton={showFavoriteButton}
          />
          <NameAvatar
            avatarUrl={avatarUrl}
            isPending={avatarPending}
            label={label}
            onToggleSelect={onToggleSelect}
            selectable={selectable}
            selected={isSelected}
            themeColor={resolvedThemeColor}
          />
          <NamePill label={label} selected={isSelected} variant={nameVariant} />
          {isSelected ? <SelectedCheck /> : verified && <VerifiedCheck />}
        </div>

        <NameOptionsMenu
          canRenew={canRenew}
          label={label}
          renewalProtocol={renewalProtocol}
        />
      </div>

      <ExpiryDetails
        cta={cta}
        expiryLabel={expiryLabel}
        label={label}
        renewalProtocol={renewalProtocol}
      />
    </div>
  )
}
