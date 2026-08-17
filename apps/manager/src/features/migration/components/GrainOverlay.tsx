import { useId } from 'react'
import { tw } from '@/utils/tailwind'

export const GrainOverlay = ({
  className,
}: {
  readonly className?: string
}) => {
  const filterId = useId()

  return (
    <svg
      aria-hidden="true"
      className={tw(
        'pointer-events-none absolute inset-0 size-full opacity-40',
        className,
      )}
    >
      <filter id={filterId}>
        <feTurbulence
          baseFrequency="0.7"
          numOctaves="4"
          seed="1"
          stitchTiles="stitch"
          type="fractalNoise"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.96
                  0 0 0 0 0.196
                  0 0 0 0 0.576
                  0 0 0 0.5 0"
        />
      </filter>
      <rect filter={`url(#${filterId})`} height="100%" width="100%" />
    </svg>
  )
}
