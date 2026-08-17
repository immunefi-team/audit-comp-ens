'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { getByteLength, getDomainCardDisplaySizeClasses } from '@/utils/domain'
import { DomainCardPattern } from './DomainCardPattern'

const domainCardContainerVariants = cva(
  'flex flex-col gap-2.5 rounded border p-2.5 shadow-lg',
  {
    variants: {
      variant: {
        garnet: 'bg-ens-garnet-core',
        lapis: 'bg-ens-lapis-core',
        peridot: 'bg-ens-peridot-core',
      },
    },
    defaultVariants: {
      variant: 'garnet',
    },
  },
)

const domainCardBadgeVariants = cva('w-full rounded px-4 py-2', {
  variants: {
    variant: {
      garnet: 'bg-ens-garnet-surface',
      lapis: 'bg-ens-lapis-surface',
      peridot: 'bg-ens-peridot-surface',
    },
  },
  defaultVariants: {
    variant: 'garnet',
  },
})

const domainCardTextVariants = cva(
  'min-h-0 w-full break-words font-medium leading-none tracking-tight',
  {
    variants: {
      variant: {
        garnet: 'text-ens-bronzite-dust',
        lapis: 'text-ens-bronzite-dust',
        peridot: 'text-ens-bronzite-dust',
      },
    },
    defaultVariants: {
      variant: 'garnet',
    },
  },
)

interface DomainCardProps
  extends VariantProps<typeof domainCardContainerVariants> {
  domainName: string
  className?: string
}

export const DomainCard = ({
  domainName,
  variant = 'garnet',
  className,
}: DomainCardProps) => {
  const selectedVariant = variant || 'garnet'
  const sizeClasses = getDomainCardDisplaySizeClasses(getByteLength(domainName))

  return (
    <div className={cn(domainCardContainerVariants({ variant }), className)}>
      <div className="flex w-full items-start justify-start">
        <div className={domainCardBadgeVariants({ variant })}>
          <p className={cn(domainCardTextVariants({ variant }), sizeClasses)}>
            {domainName}
          </p>
        </div>
      </div>
      <div className="h-48 w-full rounded">
        <DomainCardPattern domainName={domainName} variant={selectedVariant} />
      </div>
    </div>
  )
}
