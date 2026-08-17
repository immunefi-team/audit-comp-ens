import { motion, useReducedMotion } from 'motion/react'

interface PrimaryContactCapacityIndicatorProps {
  readonly maximum: number
  readonly selected: number
}

export const PrimaryContactCapacityIndicator = ({
  maximum,
  selected,
}: PrimaryContactCapacityIndicatorProps) => {
  const shouldReduceMotion = useReducedMotion()
  const completion = selected / maximum
  const backgroundImage = `conic-gradient(from 90deg, var(--color-ens-quartz-300) ${completion}turn, var(--color-ens-quartz-100) 0)`

  return (
    <div className="flex h-5.5 w-8 items-center justify-center">
      <span aria-live="polite" className="sr-only">
        {selected} of {maximum} primary contact methods selected
      </span>
      <motion.span
        animate={{ backgroundImage }}
        aria-hidden="true"
        className="size-3 rounded-full"
        initial={false}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.2, ease: [0.25, 1, 0.5, 1] }
        }
      />
    </div>
  )
}
