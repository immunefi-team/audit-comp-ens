import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const messageCardVariants = cva(
  'rounded-xl p-6 flex items-start gap-3 relative w-full max-w-lg mx-auto my-4',
  {
    variants: {
      variant: {
        // The dark hover tint suits the neutral button only; the coloured
        // variants below carry their own hover.
        primary:
          'bg-neutral-2 text-foreground **:data-[slot=button]:dark:hover:bg-white/10',
        success: 'bg-message-success-fill text-message-success-text',
        danger: 'bg-message-danger-fill text-message-danger-text',
        warning: 'bg-message-warning-fill text-message-warning-text',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

export type MessageCardVariant = NonNullable<
  VariantProps<typeof messageCardVariants>['variant']
>

const messageButtonClass: Record<MessageCardVariant, string> = {
  primary: '',
  success:
    'bg-message-success-text text-message-success-fill hover:bg-message-success-text/90',
  danger:
    'bg-message-danger-text text-message-danger-fill hover:bg-message-danger-text/90',
  warning:
    'bg-message-warning-text text-message-warning-fill hover:bg-message-warning-text/90',
}

export type MessageCardProps = {
  icon: React.ReactNode
  title: string
  titleClassName?: string
  description: React.ReactNode
  descriptionClassName?: string
  variant?: MessageCardVariant
  badge?: string
  actionButton?: {
    label: string
    onClick?: () => void
    href?: string
    /** Opens link in a new tab */
    external?: boolean
    variant?: React.ComponentProps<typeof Button>['variant']
  }
  className?: string
}

export function MessageCard({
  icon,
  title,
  titleClassName,
  description,
  descriptionClassName,
  variant = 'primary',
  badge,
  actionButton,
  className,
}: MessageCardProps) {
  return (
    <div
      data-slot="message-card"
      className={cn(messageCardVariants({ variant }), className)}
    >
      {badge && (
        <Badge variant="outline" className="absolute top-4 right-4 text-xs">
          {badge}
        </Badge>
      )}

      <div
        data-slot="icon"
        className="flex items-center justify-center mt-[3px] shrink-0"
      >
        {icon}
      </div>

      <div className="flex flex-col items-start gap-4 flex-1 min-w-0">
        <h2
          data-slot="title"
          className={cn(
            'font-serif text-3xl font-normal leading-none tracking-[-0.02em]',
            titleClassName,
          )}
        >
          {title}
        </h2>

        {description && (
          <div
            data-slot="description"
            className={cn(
              'text-p wrap-break-word whitespace-normal max-w-full overflow-wrap-anywhere',
              descriptionClassName,
            )}
          >
            {description}
          </div>
        )}

        {actionButton && (
          <Button
            variant={actionButton.variant || 'default'}
            className={cn(!actionButton.variant && messageButtonClass[variant])}
            onClick={actionButton.onClick}
            asChild={!!actionButton.href}
          >
            {actionButton.href ? (
              <a
                href={actionButton.href}
                {...(actionButton.external && {
                  target: '_blank',
                  rel: 'noopener noreferrer',
                })}
              >
                {actionButton.label}
              </a>
            ) : (
              actionButton.label
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
