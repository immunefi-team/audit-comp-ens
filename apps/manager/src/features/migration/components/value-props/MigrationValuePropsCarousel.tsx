import { useLingui } from '@lingui/react/macro'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import type { KeyboardEvent } from 'react'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { MigrationValuePropMediaCard } from './MigrationValuePropMediaCard'
import {
  MIGRATION_VALUE_PROP_SLIDES,
  type MigrationValuePropSlide,
} from './migrationValueProps'

const clampIndex = (index: number, length: number) =>
  Math.max(0, Math.min(index, length - 1))

const DRAG_THRESHOLD = 48
const SWIPE_VELOCITY_THRESHOLD = 350
const DESKTOP_CARD_OFFSET = 96

const getDesktopSlideState = (index: number, activeIndex: number) => {
  const offset = index - activeIndex
  const distance = Math.abs(offset)
  const isActive = offset === 0

  return {
    distance,
    isActive,
    isVisible: distance <= 1,
    offset,
  }
}

const getDesktopCardPosition = (offset: number) => offset * DESKTOP_CARD_OFFSET

type DesktopSlideButtonProps = {
  readonly ariaLabel: string
  readonly index: number
  readonly isActive: boolean
  readonly isVisible: boolean
  readonly label: string
  readonly media: MigrationValuePropSlide['media']
  readonly offset: number
  readonly onActivate: (index: number) => void
  readonly onDragEnd: (offsetX: number, velocityX: number) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  readonly shouldReduceMotion: boolean
  readonly zIndex: number
}

const DesktopSlideButton = ({
  ariaLabel,
  index,
  isActive,
  isVisible,
  label,
  media,
  offset,
  onActivate,
  onDragEnd,
  onKeyDown,
  shouldReduceMotion,
  zIndex,
}: DesktopSlideButtonProps) => {
  const dragX = useMotionValue(0)
  const dragRotate = useTransform(dragX, [-180, 0, 180], [-5, 0, 5])
  const dragScale = useTransform(dragX, [-180, 0, 180], [0.985, 1, 0.985])

  return (
    <motion.div
      animate={{
        filter: shouldReduceMotion
          ? 'blur(0px)'
          : isActive
            ? 'blur(0px)'
            : 'blur(4px)',
        opacity: isVisible ? (isActive ? 1 : 0.52) : 0,
        x: getDesktopCardPosition(offset),
        y: isActive ? 0 : 14,
        zIndex,
      }}
      // The fixed width and radius match the exported value-prop card assets.
      className="absolute top-0 left-1/2 w-[228px] -translate-x-1/2"
      initial={false}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              damping: 28,
              mass: 0.9,
              stiffness: 260,
              type: 'spring',
            }
      }
    >
      <motion.button
        aria-label={ariaLabel}
        className={cn(
          'flex w-full flex-col items-center gap-4 rounded-[28px] pt-2 outline-none focus-visible:ring-2 focus-visible:ring-ens-lapis-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          isActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          !isVisible && 'pointer-events-none',
        )}
        drag={isActive && !shouldReduceMotion ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onClick={() => onActivate(index)}
        onDragEnd={(_, info) => onDragEnd(info.offset.x, info.velocity.x)}
        onKeyDown={onKeyDown}
        style={
          shouldReduceMotion || !isActive
            ? undefined
            : {
                rotate: dragRotate,
                scale: dragScale,
                x: dragX,
              }
        }
        type="button"
      >
        <MigrationValuePropMediaCard media={media} />
        <p className="font-semi-mono text-ens-garnet-500 text-xs uppercase leading-[1.2] tracking-[0.12px]">
          {label}
        </p>
      </motion.button>
    </motion.div>
  )
}

export const MigrationValuePropsCarousel = () => {
  const { t } = useLingui()
  const shouldReduceMotion = useReducedMotion() ?? false
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampIndex(
        nextIndex,
        MIGRATION_VALUE_PROP_SLIDES.length,
      )
      setActiveIndex(clampedIndex)

      const el = scrollRef.current
      if (!el || el.offsetWidth === 0) return

      el.scrollTo({
        left: clampedIndex * el.offsetWidth,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      })
    },
    [shouldReduceMotion],
  )

  const goToNext = useCallback(
    () => goToIndex(activeIndex + 1),
    [activeIndex, goToIndex],
  )

  const goToPrevious = useCallback(
    () => goToIndex(activeIndex - 1),
    [activeIndex, goToIndex],
  )

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.offsetWidth === 0) return

    const nextIndex = Math.round(el.scrollLeft / el.offsetWidth)
    setActiveIndex(clampIndex(nextIndex, MIGRATION_VALUE_PROP_SLIDES.length))
  }, [])

  const handleDesktopDragEnd = useCallback(
    (offsetX: number, velocityX: number) => {
      if (
        offsetX <= -DRAG_THRESHOLD ||
        velocityX <= -SWIPE_VELOCITY_THRESHOLD
      ) {
        goToNext()
        return
      }

      if (offsetX >= DRAG_THRESHOLD || velocityX >= SWIPE_VELOCITY_THRESHOLD) {
        goToPrevious()
      }
    },
    [goToNext, goToPrevious],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNext()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPrevious()
      }
    },
    [goToNext, goToPrevious],
  )

  return (
    <section aria-label={t`Migration value propositions`} className="w-full">
      <div className="mb-2 flex items-center justify-center gap-0.5">
        {MIGRATION_VALUE_PROP_SLIDES.map((slide, index) => (
          <button
            aria-current={index === activeIndex ? 'true' : undefined}
            aria-label={t(slide.label)}
            className={cn(
              // Dot widths match the Figma active/inactive indicator sizes.
              'rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-ens-lapis-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              index === activeIndex
                ? 'h-1.5 w-[19px] bg-ens-garnet-500'
                : 'h-1.5 w-[7px] bg-ens-garnet-500/50',
            )}
            key={slide.id}
            onClick={() => goToIndex(index)}
            onKeyDown={handleKeyDown}
            type="button"
          />
        ))}
      </div>

      <div className="w-full md:hidden">
        <div
          className="flex snap-x snap-mandatory overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
          ref={scrollRef}
        >
          {MIGRATION_VALUE_PROP_SLIDES.map((slide) => (
            <div
              className="flex w-full shrink-0 snap-center flex-col items-center gap-3 px-5 max-[700px]:gap-2.5"
              key={slide.id}
            >
              <MigrationValuePropMediaCard
                // This clamp keeps the mobile card close to the Figma size while
                // still shrinking on short viewports so the CTA remains reachable.
                className="max-w-[clamp(11rem,43dvh,15.5rem)]"
                media={slide.media}
              />
              <p className="font-semi-mono text-ens-garnet-500 text-xs uppercase leading-[1.2] tracking-[0.12px]">
                {t(slide.label)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative hidden min-h-94 w-full overflow-hidden pt-1 md:block">
        {MIGRATION_VALUE_PROP_SLIDES.map((slide, index) => {
          const { distance, isActive, isVisible, offset } =
            getDesktopSlideState(index, activeIndex)

          return (
            <DesktopSlideButton
              ariaLabel={t(slide.label)}
              index={index}
              isActive={isActive}
              isVisible={isVisible}
              key={slide.id}
              label={t(slide.label)}
              media={slide.media}
              offset={offset}
              onActivate={goToIndex}
              onDragEnd={handleDesktopDragEnd}
              onKeyDown={handleKeyDown}
              shouldReduceMotion={shouldReduceMotion}
              zIndex={MIGRATION_VALUE_PROP_SLIDES.length - distance}
            />
          )
        })}
      </div>
    </section>
  )
}
