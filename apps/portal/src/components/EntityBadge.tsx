import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import {
  ChipLinkIcon,
  ChipNameIcon,
  ChipWalletIcon,
  HubIcon,
  ResolverIcon,
} from '@/assets/icons'
import {
  EntityActionCopy,
  entityActionVariants,
} from '@/components/EntityAction'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getSupportsInterfacesQueryOptions } from '@/hooks/useSupportsInterfaces'
import { RESOLVER_INTERFACE_IDS } from '@/lib/constants/resolverInterfaceIds'
import { cn } from '@/lib/utils'
import { getEnsContractName } from '@/utils/ens/ensContractNames'

export type EntityVariant = 'name' | 'address' | 'contract' | 'tx' | 'default'

// Combined (bg + text) — used for the standalone pill (no chips attached).
const variantClass: Record<EntityVariant, string> = {
  name: 'bg-accent-fill dark:bg-entity-bg text-accent-text',
  address: 'bg-success-fill dark:bg-entity-bg text-success-text',
  contract: 'bg-danger-fill dark:bg-entity-bg text-danger-text',
  tx: 'bg-warning-fill dark:bg-entity-bg text-warning-text',
  default: 'bg-default-fill dark:bg-entity-bg text-default-text',
}

// Fill only — used for the animated absolute bg div in the chip-enhanced path.
const variantBgClass: Record<EntityVariant, string> = {
  name: 'bg-accent-fill',
  address: 'bg-success-fill',
  contract: 'bg-danger-fill',
  tx: 'bg-warning-fill',
  default: 'bg-default-fill',
}

// Text only — used for the pill in the chip-enhanced path (bg comes from the
// absolute div so the pill's own background must be transparent).
const variantTextClass: Record<EntityVariant, string> = {
  name: 'text-accent-text',
  address: 'text-success-text',
  contract: 'text-danger-text',
  tx: 'text-warning-text',
  default: 'text-default-text',
}

export const hoverBgClass: Record<EntityVariant, string> = {
  name: 'hover:bg-accent-fill dark:hover:bg-entity-bg',
  address: 'hover:bg-success-fill dark:hover:bg-entity-bg',
  contract: 'hover:bg-danger-fill dark:hover:bg-entity-bg',
  tx: 'hover:bg-warning-fill dark:hover:bg-entity-bg',
  default: 'hover:bg-default-fill dark:hover:bg-entity-bg',
}

// Shared pill layout. Typography comes from the Figma entity styles
// (text-entity-* utilities in src/styles/index.css): names are Semi-Mono 500,
// everything else Mono (WEB-595).
const pillBase =
  'inline-flex items-center h-5 px-1 rounded w-fit ' +
  'leading-none whitespace-nowrap no-underline'

// format-specific classes: truncate needs the min-width chain broken at every
// flex level so the fill shrinks WITH the text; wrap trades the fixed pill
// height for multi-line content that stays inside the fill.
const formatConstraintClass: Record<string, string> = {
  inline: '',
  truncate: 'max-w-full min-w-0',
  wrap: 'max-w-full min-w-0',
}
const formatPillClass: Record<string, string> = {
  inline: '',
  truncate: 'max-w-full min-w-0',
  wrap: 'h-auto min-h-5 max-w-full whitespace-normal',
}

/** Wrap + label: stack on mobile only; side-by-side from sm up. */
const labeledWrapPillClass =
  'max-sm:flex-col max-sm:items-start max-sm:gap-0.5 max-sm:w-fit'

const pillType = (variant: EntityVariant) =>
  variant === 'name' ? 'text-entity-name' : 'text-entity-base'

// Standalone pill: self-contained bg + text (used when there are no chips).
const pillClass = (variant: EntityVariant, className?: string) =>
  cn(pillBase, pillType(variant), variantClass[variant], className)

const chipClass = entityActionVariants()

interface EntityBadgeProps {
  readonly children: ReactNode
  readonly variant: EntityVariant
  readonly className?: string
  /** Optional leading label rendered inside the pill */
  readonly label?: string
  /** ENS name — enables Name chip (→ /$name) + Copy chip */
  readonly name?: string
  /** Owner ENS name — enables Owner chip (→ /$ownerName) */
  readonly ownerName?: string
  /** Owner address — enables Owner chip (→ /addr/$ownerAddress) when ownerName is absent */
  readonly ownerAddress?: Address
  /** Address — enables Address chip (→ /addr/$address) */
  readonly address?: Address
  /** Mark a contract `address` as a registry — enables Registry chip + primary action (→ /registry/$address) */
  readonly isRegistry?: boolean
  /** TLD label (e.g. "eth") — for a contract, enables a TLD chip + primary action (→ /tld/$tld) */
  readonly tld?: string
  /** Block explorer URL — enables Etherscan chip */
  readonly etherscanHref?: string
  /** Value to copy. Defaults: name → name, address/contract → address */
  readonly copyValue?: string
  /** Opt-in to a leading NameAvatar (only renders for variant="name" + name). */
  readonly showAvatar?: boolean
  /**
   * Figma entity type. "action" (default) always shows the fill; "content"
   * shows plain text at rest and only fills on hover/focus — meant for long
   * lists of hashes and values where permanent pills would be noisy.
   */
  readonly type?: 'action' | 'content'
  /**
   * Figma entity format. "inline" (default) sizes to its content; "truncate"
   * ellipsizes inside the fill when the container constrains it (tables);
   * "wrap" breaks long values across lines inside the fill. With a `label`,
   * wrap also stacks the label above the value on mobile only (`max-sm`),
   * keeping them side-by-side from `sm` up.
   */
  readonly format?: 'inline' | 'truncate' | 'wrap'
  /**
   * Drop the vertical padding the chip-enhanced variant reserves for its hover
   * chips, so the badge doesn't inflate dense rows. The chips still overflow on
   * hover (they're absolutely positioned) — only the reserved layout height is gone.
   */
  readonly compact?: boolean
}

/**
 * Parent-scope classes that restore EntityBadge's hover-chip horizontal padding
 * (`-ml-2` + inner `px-2`) for leading / left-column slots. Right-aligned badges
 * omit this so their right edge can share a common gutter with the row.
 */
export const entityBadgeLeadingPadScope =
  '[&_[data-entity-badge]]:-ml-2 [&_[data-entity-badge]>a]:px-2 [&_[data-entity-badge]>div:not([data-entity-chips])]:px-2'

export const EntityBadge = ({
  children,
  variant,
  className,
  label,
  name,
  ownerName,
  ownerAddress,
  address,
  isRegistry = false,
  tld,
  etherscanHref,
  copyValue,
  showAvatar = false,
  type = 'action',
  format = 'inline',
  compact = false,
}: EntityBadgeProps) => {
  const stacksLabel = !!label && format === 'wrap'

  const labelContent = label ? (
    <span
      className={cn(
        'bg-background text-center text-entity-label leading-none px-1 py-0.5 rounded-[2px]',
        // Side-by-side uses margin; wrap stacks on mobile and uses gap there.
        stacksLabel ? 'max-sm:mr-0 sm:mr-1' : 'mr-1',
      )}
    >
      {label}
    </span>
  ) : null

  const { data: resolverInterfaces } = useQuery({
    ...getSupportsInterfacesQueryOptions({
      address: address ?? zeroAddress,
      interfaces: Object.values(RESOLVER_INTERFACE_IDS),
    }),
    enabled: variant === 'contract' && !!address,
  })
  const isResolver = resolverInterfaces?.some(Boolean) ?? false
  const contractName =
    variant === 'contract' && address ? getEnsContractName(address) : undefined

  const derivedCopyValue =
    copyValue ?? (variant === 'name' ? name : address) ?? ''

  const resolvedAvatar =
    showAvatar && variant === 'name' && name ? (
      <NameAvatar
        name={name}
        width="20px"
        height="20px"
        rounded="rounded-[2px]"
      />
    ) : null

  const hasChips = !!(
    name ||
    ownerName ||
    ownerAddress ||
    address ||
    tld ||
    etherscanHref ||
    derivedCopyValue
  )

  const content =
    format === 'truncate' ? (
      <span className="truncate">{children}</span>
    ) : format === 'wrap' ? (
      <span className="break-all">{children}</span>
    ) : (
      children
    )

  if (!hasChips) {
    return (
      <span
        className={cn(
          pillClass(variant, className),
          'h-6 rounded',
          formatPillClass[format],
          stacksLabel && labeledWrapPillClass,
          type === 'content' && 'bg-transparent dark:bg-transparent',
        )}
      >
        {labelContent}
        {content}
      </span>
    )
  }

  // Real <Link>/<a> elements preserve middle-click, ⌘+click, "Open in new
  // tab", status-bar URL preview, and right-click affordances — none of
  // which work with a button + navigate() pattern.
  const primaryWrapperClass = cn(
    'inline-flex items-center gap-2 rounded cursor-pointer text-left no-underline',
    formatConstraintClass[format],
    // Keep the hit area hugging the stacked pill — otherwise wrap+label
    // stretches to the grid cell and leaves empty fill on the right.
    stacksLabel && 'w-fit max-w-full',
    // `py-2.5` reserves room for the hover chips (which sit above the pill). `compact`
    // drops it for dense rows — the chips still overflow, they just aren't reserved for.
    compact ? 'py-0' : 'py-2.5',
    // avatar pills are h-6 (24px), so tighten the hover bridge to keep the
    // whole badge at exactly 40px like text-only pills (20px + 2*10px)
    resolvedAvatar && !compact && 'py-2',
  )

  const renderPrimary = () => {
    if (variant === 'name' && name) {
      return (
        <Link to="/$name" params={{ name }} className={primaryWrapperClass}>
          {pillNode}
        </Link>
      )
    }
    if (variant === 'address' && address) {
      return (
        <Link
          to="/addr/$addr"
          params={{ addr: address }}
          className={primaryWrapperClass}
        >
          {pillNode}
        </Link>
      )
    }
    if (variant === 'contract' && isRegistry && address) {
      return (
        <Link
          to="/registry/$address"
          params={{ address }}
          className={primaryWrapperClass}
        >
          {pillNode}
        </Link>
      )
    }
    if (variant === 'contract' && isResolver && address) {
      return (
        <Link
          to="/resolver/$address"
          params={{ address }}
          className={primaryWrapperClass}
        >
          {pillNode}
        </Link>
      )
    }
    if (variant === 'contract' && tld) {
      return (
        <Link to="/tld/$tld" params={{ tld }} className={primaryWrapperClass}>
          {pillNode}
        </Link>
      )
    }
    if (variant === 'contract' && !isRegistry && !isResolver && etherscanHref) {
      return (
        <a
          href={etherscanHref}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryWrapperClass}
        >
          {pillNode}
        </a>
      )
    }
    if (variant === 'tx' && etherscanHref) {
      return (
        <a
          href={etherscanHref}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryWrapperClass}
        >
          {pillNode}
        </a>
      )
    }
    return <div className={primaryWrapperClass}>{pillNode}</div>
  }

  /*
   * Chip-enhanced pill.
   *
   * An absolutely-positioned bg div lives *inside* a `relative` wrapper span
   * so it never affects layout. At rest it sits 2px outside the pill on every
   * side (matching the Figma "always-on" small halo). On group hover it
   * expands to 12px outside — the same zone the chips occupy — giving the
   * appearance of the badge growing to accommodate them. CSS inset transition
   * makes it smooth without any layout shift.
   */
  const pillNode = (
    <span
      className={cn(
        'relative inline-flex items-center',
        formatConstraintClass[format],
        stacksLabel && 'w-fit max-w-full',
      )}
    >
      <span
        className={cn(
          'absolute rounded transition-[inset,opacity] duration-150',
          // Content entities keep the fill hidden until hover/focus reveals
          // the chips, so resting rows read as plain text.
          type === 'content' &&
            'opacity-0 group-hover/entity:opacity-100 group-has-[:focus-visible]/entity:opacity-100',
          // Horizontal px-1 on the pill adds 4px of internal colored area on
          // each side; vertical centering in h-5 adds only 3px. Use -1px x-inset
          // vs -2px y-inset so the visible rim is equal (~5px) on all sides.
          // When a label is present its bg-background sub-chip acts as a visual
          // reference that makes the left strip read one pixel too wide, so
          // flush the x-inset to 0 in that case.
          'inset-y-[-2px]',
          // No label: bg extends 1px beyond pill edge → ~5px colored strip to text (matches top)
          // With label: label sub-chip (~18px) in a 20px pill leaves only 1px above it, so
          //   push x inset 1px *inside* the pill edge → 3px strip to sub-chip (matches top)
          label
            ? 'inset-x-px'
            : resolvedAvatar
              ? 'inset-x-[-2px]'
              : 'inset-x-[-1px]',
          'group-hover/entity:inset-[-12px]',
          variantBgClass[variant],
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          pillBase,
          pillType(variant),
          formatPillClass[format],
          'relative z-10',
          variantTextClass[variant],
          // Keep px-1 around the avatar so the fill visibly wraps it
          // and add gap-1 so avatar doesn't touch the text
          resolvedAvatar && 'h-6 gap-1.5',
          stacksLabel && labeledWrapPillClass,
          className,
        )}
      >
        {resolvedAvatar && <span className="shrink-0">{resolvedAvatar}</span>}
        {labelContent}
        {content}
      </span>
    </span>
  )

  return (
    <div
      data-entity-badge
      className={cn(
        'relative group/entity inline-flex',
        (format === 'truncate' || format === 'wrap') && 'max-w-full min-w-0',
        stacksLabel && 'w-fit',
      )}
    >
      {/*
        Chip container's bottom-left corner sits INSIDE the hover zone:
        - `bottom: calc(100% - 6px)` puts chip bottom 6px below wrapper top
          (= 4px above pill top, bridged by the inner wrapper's py-2.5)
        - `left-2` puts chip left 8px inside wrapper from left
          (matching Figma's chip-to-bg-edge gap of 8px)
      */}
      <div
        data-entity-chips
        className={cn(
          'absolute bottom-[calc(100%-6px)] left-2 flex flex-row gap-1 z-50',
          // Reveal on mouse hover and on keyboard focus-within the badge;
          // opacity/pointer-events (not display:none) keeps chips in the tab
          // order and the accessibility tree.
          'opacity-0 pointer-events-none transition-opacity',
          'group-hover/entity:opacity-100 group-hover/entity:pointer-events-auto',
          'group-has-[:focus-visible]/entity:opacity-100 group-has-[:focus-visible]/entity:pointer-events-auto',
        )}
      >
        {variant === 'name' && name && (
          <Link to="/$name" params={{ name }} className={chipClass}>
            <ChipNameIcon className="size-3.25" />
            Name
          </Link>
        )}

        {variant === 'name' && ownerName && (
          <Link to="/$name" params={{ name: ownerName }} className={chipClass}>
            <ChipWalletIcon className="size-3.25" />
            Owner
          </Link>
        )}

        {variant === 'name' && !ownerName && ownerAddress && (
          <Link
            to="/addr/$addr"
            params={{ addr: ownerAddress }}
            className={chipClass}
          >
            <ChipWalletIcon className="size-3.25" />
            Owner
          </Link>
        )}

        {variant === 'address' && address && (
          <Link
            to="/addr/$addr"
            params={{ addr: address }}
            className={chipClass}
          >
            <ChipWalletIcon className="size-3.25" />
            Address
          </Link>
        )}

        {variant === 'contract' && isResolver && address && (
          <Link
            to="/resolver/$address"
            params={{ address }}
            className={chipClass}
          >
            <ResolverIcon className="size-3.25" />
            Resolver
          </Link>
        )}

        {/* Auto-derived contract-name chip — suppressed when the caller gives an
            explicit `label` (e.g. "root registry"), which already names the pill. */}
        {!label && contractName && (
          <EntityActionCopy
            value={contractName}
            label={contractName}
            showIcon={false}
          />
        )}

        {variant === 'contract' && isRegistry && address && (
          <Link
            to="/registry/$address"
            params={{ address }}
            className={chipClass}
          >
            <HubIcon className="size-3.25" />
            Registry
          </Link>
        )}

        {variant === 'contract' && tld && (
          <Link to="/tld/$tld" params={{ tld }} className={chipClass}>
            <ChipNameIcon className="size-3.25" />
            TLD
          </Link>
        )}

        {derivedCopyValue && <EntityActionCopy value={derivedCopyValue} />}

        {variant !== 'default' && etherscanHref && (
          <a
            href={etherscanHref}
            target="_blank"
            rel="noopener noreferrer"
            className={chipClass}
          >
            <ChipLinkIcon className="size-3.25" />
            Etherscan
          </a>
        )}
      </div>

      {renderPrimary()}
    </div>
  )
}
