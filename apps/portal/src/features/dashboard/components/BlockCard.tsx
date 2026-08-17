import { createLink } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronRight } from 'lucide-react'
import { forwardRef, type ReactNode, type SVGProps } from 'react'
import { ExternalLink } from 'react-external-link'
import { cn } from '@/lib/utils'

const baseCardClass =
  'group flex flex-col h-[212px] w-full rounded-sm p-[18px] transition-colors'

export const InfoBlockCard = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <div
    className={cn(
      baseCardClass,
      'bg-secondary dark:bg-accent gap-3 items-start',
    )}
  >
    <p className="font-medium text-base text-foreground leading-snug">
      {title}
    </p>
    <p className="text-base text-muted-foreground leading-snug">
      {description}
    </p>
  </div>
)

const linkCardBorder = cva('border-border dark:border-[#2b2b2b]', {
  variants: {
    hoverColor: {
      lapis: 'hover:border-lapis-500 dark:hover:border-lapis-400',
      peridot: 'hover:border-peridot-500 dark:hover:border-peridot-400',
      garnet: 'hover:border-garnet-500 dark:hover:border-garnet-500',
    },
  },
})

const linkCardTitle = cva('text-muted-foreground', {
  variants: {
    hoverColor: {
      lapis: 'group-hover:text-lapis-500 dark:group-hover:text-lapis-400',
      peridot: 'group-hover:text-peridot-500 dark:group-hover:text-peridot-400',
      garnet: 'group-hover:text-garnet-500 dark:group-hover:text-garnet-500',
    },
  },
})

const linkCardChevronBg = cva('bg-secondary dark:bg-accent', {
  variants: {
    hoverColor: {
      lapis: 'group-hover:bg-lapis-100 dark:group-hover:bg-lapis-900',
      peridot: 'group-hover:bg-peridot-100 dark:group-hover:bg-peridot-900',
      garnet: 'group-hover:bg-garnet-100 dark:group-hover:bg-garnet-900',
    },
  },
})

const linkCardChevronIcon = cva('text-muted-foreground/40', {
  variants: {
    hoverColor: {
      lapis: 'group-hover:text-lapis-500 dark:group-hover:text-lapis-400',
      peridot: 'group-hover:text-peridot-500 dark:group-hover:text-peridot-400',
      garnet: 'group-hover:text-garnet-500 dark:group-hover:text-garnet-500',
    },
  },
})

type LinkBlockCardProps = {
  title: string
  description?: string
  href: string
} & VariantProps<typeof linkCardBorder>

export const LinkBlockCard = ({
  title,
  description,
  href,
  hoverColor,
}: LinkBlockCardProps) => (
  <ExternalLink
    href={href}
    className={cn(
      baseCardClass,
      'bg-popover dark:bg-background border items-end justify-between',
      linkCardBorder({ hoverColor }),
    )}
  >
    <div className="flex flex-col gap-7 items-start w-full">
      <p
        className={cn(
          'font-medium text-base leading-snug w-full',
          linkCardTitle({ hoverColor }),
        )}
      >
        {title}
      </p>
      {description && (
        <p className="text-sm text-muted-foreground leading-snug w-full">
          {description}
        </p>
      )}
    </div>
    <div
      className={cn(
        'flex items-center justify-center rounded-xs w-6 h-11.75 shrink-0 self-end transition-colors',
        linkCardChevronBg({ hoverColor }),
      )}
    >
      <ChevronRight
        className={cn(
          'size-4 transition-colors',
          linkCardChevronIcon({ hoverColor }),
        )}
      />
    </div>
  </ExternalLink>
)

type DataBlockCardOwnProps = {
  icon: React.ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
  label: string
  value: ReactNode
}

const DataBlockCardBase = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & DataBlockCardOwnProps
>(({ icon: Icon, label, value, className, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    className={cn(
      'group flex h-20 max-w-[300px] items-center gap-3 p-4 rounded-lg bg-background border border-secondary hover:bg-sidebar transition-colors',
      className,
    )}
  >
    <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
        <Icon className="size-4 shrink-0" />
        <span className="text-ui truncate">{label}</span>
      </div>
      <span className="text-xl font-medium text-foreground shrink-0">
        {value}
      </span>
    </div>
    <div className="flex items-center justify-center w-6 h-11.75 rounded-xs bg-sidebar group-hover:bg-card shrink-0 transition-colors">
      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </div>
  </a>
))
DataBlockCardBase.displayName = 'DataBlockCardBase'

export const DataBlockCard = createLink(DataBlockCardBase)

export const DataBlockCardError = ({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
  message: string
}) => (
  <div className="flex h-20 max-w-[300px] items-center gap-2 p-4 rounded-lg bg-background border border-secondary text-muted-foreground">
    <Icon className="size-4 shrink-0" />
    <span className="text-ui">{message}</span>
  </div>
)

export const BlockCard = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'flex items-center gap-4 p-4 rounded-lg bg-background border border-secondary w-full min-h-20',
      className,
    )}
  >
    {children}
  </div>
)
