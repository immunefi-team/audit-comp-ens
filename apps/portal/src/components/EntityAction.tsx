import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ChipCopyIcon } from '@/assets/icons'
import { cn } from '@/lib/utils'

const entityActionVariants = cva(
  cn(
    'inline-flex items-center cursor-pointer transition-colors',
    'h-7 px-2 gap-1.5 rounded-sm',
    'border border-neutral-3 bg-neutral-0 text-neutral-7',
    'hover:border-neutral-5 hover:text-neutral-8',
    'active:bg-neutral-1 active:border-neutral-5 active:text-neutral-8',
    'outline-hidden focus-visible:border-neutral-5 focus-visible:text-neutral-8 focus-visible:ring-[3px] focus-visible:ring-neutral-5/50',
    'text-[11px] font-normal no-underline',
  ),
  {
    variants: {
      font: {
        // The reset is on the variant, not the base: timeline parents (MetaRow,
        // table cells) hand down mono and letter-spacing, and cva concatenates
        // base + variant without merging, so a base-level `font-sans` would
        // ride along into `mono`.
        sans: 'font-sans tracking-normal',
        mono: 'h-auto min-h-7 py-1.5 text-left font-mono tracking-[0.02em] break-all whitespace-normal',
      },
    },
    defaultVariants: {
      font: 'sans',
    },
  },
)

type EntityActionProps = React.ComponentProps<'button'> &
  VariantProps<typeof entityActionVariants> & {
    asChild?: boolean
  }

export const EntityAction = ({
  className,
  font,
  asChild = false,
  ...props
}: EntityActionProps) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="entity-action"
      type={asChild ? undefined : 'button'}
      className={cn(entityActionVariants({ font }), className)}
      {...props}
    />
  )
}

export const EntityActionCopy = ({
  value,
  label = 'Copy',
  showIcon = true,
  font,
  className,
}: {
  readonly value: string
  readonly label?: string
  readonly showIcon?: boolean
  readonly keepLabelWhenCopied?: boolean
  readonly font?: VariantProps<typeof entityActionVariants>['font']
  readonly className?: string
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // clipboard access denied or unavailable — silently ignore
    }
  }

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  return (
    <EntityAction
      font={font}
      className={className}
      onClick={handleCopy}
      aria-label={label || 'Copy'}
    >
      {/* Only the icon swaps on copy: where the label is the value itself (an
          address in a hover card), dropping it resizes the chip out from under
          the pointer and closes the card. */}
      {copied ? (
        <CheckIcon className="size-3.25 shrink-0" />
      ) : (
        showIcon && <ChipCopyIcon className="size-3.25 shrink-0" />
      )}
      {label || null}
    </EntityAction>
  )
}

export { entityActionVariants }
