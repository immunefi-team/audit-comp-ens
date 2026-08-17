import { Star } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

interface PrimaryContactButtonProps {
  readonly disabled: boolean
  readonly label: string
  readonly onClick: () => void
  readonly selected: boolean
}

export const PrimaryContactButton = ({
  disabled,
  label,
  onClick,
  selected,
}: PrimaryContactButtonProps) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      aria-label={
        selected
          ? `Remove ${label} from primary contact methods`
          : `Add ${label} to primary contact methods`
      }
      aria-pressed={selected}
      className="flex h-11 w-8 shrink-0 items-center justify-center rounded-sm p-1 outline-none focus-visible:ring-3 focus-visible:ring-ens-lapis-500/50 disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={onClick}
      transition={
        shouldReduceMotion
          ? undefined
          : { duration: 0.15, ease: [0.25, 1, 0.5, 1] }
      }
      type="button"
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.9 }}
    >
      <Star
        aria-hidden="true"
        className={cn(
          'size-5 fill-ens-quartz-50 text-ens-quartz-300 transition-[fill,color] duration-200 ease-out motion-reduce:transition-none',
          selected && 'fill-ens-signal-warning-500 text-ens-signal-warning-500',
        )}
        strokeWidth={1.25}
      />
    </motion.button>
  )
}
