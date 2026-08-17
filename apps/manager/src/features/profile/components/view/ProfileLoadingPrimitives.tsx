import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { tw } from '@/utils/tailwind'

type SkeletonBlockProps = {
  readonly className?: string
  readonly isSolid?: boolean
  readonly shouldReduceMotion: boolean
}

type ProfileSectionLoadingProps = {
  readonly children: React.ReactNode
  readonly className?: string
  readonly index: number
  readonly shouldReduceMotion: boolean
  readonly titleWidth: string
}

export const loadingCardSurfaceClassName =
  'rounded-[14px] border-[0.692px] border-[rgba(199,198,196,0.25)] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] lg:landscape:rounded-xl lg:landscape:border-[0.25px] lg:landscape:border-ens-quartz-300'

export const getMotionProps = (_shouldReduceMotion: boolean, _delay = 0) => ({})

export const SkeletonBlock = ({
  className,
  isSolid = false,
  shouldReduceMotion,
}: SkeletonBlockProps) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-md',
      isSolid ? 'bg-ens-quartz-200' : 'bg-ens-quartz-200/75',
      className,
    )}
  >
    {shouldReduceMotion ? null : (
      <div className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/35 to-transparent" />
    )}
  </div>
)

export const ProfileSectionLoading = ({
  children,
  className = '',
  index,
  shouldReduceMotion,
  titleWidth,
}: ProfileSectionLoadingProps) => (
  <motion.section
    className={tw(
      'border-[0.25px] border-transparent bg-transparent px-5 py-6 shadow-none lg:landscape:px-8 lg:landscape:pt-8 lg:landscape:pb-6',
      className,
    )}
    {...getMotionProps(shouldReduceMotion, index * 0.05)}
  >
    <SkeletonBlock
      className={tw('h-6', titleWidth)}
      shouldReduceMotion={shouldReduceMotion}
    />
    <div className="mt-6">{children}</div>
  </motion.section>
)
