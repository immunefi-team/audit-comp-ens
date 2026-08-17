import { Trans, useLingui } from '@lingui/react/macro'
import { CircleArrowLeft, CircleArrowRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FEATURE_CARDS } from '@/features/landing/FeaturesCarousel'
import { cn } from '@/lib/utils'

const SCROLL_TOLERANCE = 2

type CarouselState = {
  readonly canScrollNext: boolean
  readonly canScrollPrevious: boolean
  readonly isScrollable: boolean
}

const INITIAL_CAROUSEL_STATE: CarouselState = {
  canScrollNext: false,
  canScrollPrevious: false,
  isScrollable: false,
}

const getCarouselState = (carousel: HTMLElement): CarouselState => {
  const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth)

  return {
    canScrollNext: carousel.scrollLeft < maxScrollLeft - SCROLL_TOLERANCE,
    canScrollPrevious: carousel.scrollLeft > SCROLL_TOLERANCE,
    isScrollable: maxScrollLeft > SCROLL_TOLERANCE,
  }
}

const isSameCarouselState = (a: CarouselState, b: CarouselState) =>
  a.canScrollNext === b.canScrollNext &&
  a.canScrollPrevious === b.canScrollPrevious &&
  a.isScrollable === b.isScrollable

const getCardStep = (carousel: HTMLElement) => {
  const track = carousel.firstElementChild
  if (!(track instanceof HTMLElement)) return carousel.clientWidth

  const cards = Array.from(track.querySelectorAll<HTMLElement>('article'))
  const firstCard = cards[0]
  const secondCard = cards[1]
  if (!firstCard) return carousel.clientWidth
  if (!secondCard) return firstCard.offsetWidth

  return Math.abs(secondCard.offsetLeft - firstCard.offsetLeft)
}

const getTrailingSpace = (carousel: HTMLElement) => {
  const trailingElement = carousel.firstElementChild?.lastElementChild
  if (!(trailingElement instanceof HTMLElement)) return 0
  if (trailingElement.tagName === 'ARTICLE') return 0

  return trailingElement.offsetWidth
}

const useEducationCarousel = () => {
  const shouldReduceMotion = useReducedMotion() ?? false
  const carouselRef = useRef<HTMLElement>(null)
  const [carouselState, setCarouselState] = useState(INITIAL_CAROUSEL_STATE)

  const updateCarouselState = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const nextState = getCarouselState(carousel)
    setCarouselState((currentState) =>
      isSameCarouselState(currentState, nextState) ? currentState : nextState,
    )
  }, [])

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    updateCarouselState()
    carousel.addEventListener('scroll', updateCarouselState, {
      passive: true,
    })

    const resizeObserver = new ResizeObserver(updateCarouselState)
    resizeObserver.observe(carousel)
    const track = carousel.firstElementChild
    if (track) resizeObserver.observe(track)

    return () => {
      carousel.removeEventListener('scroll', updateCarouselState)
      resizeObserver.disconnect()
    }
  }, [updateCarouselState])

  const scrollByCard = useCallback(
    (direction: -1 | 1) => {
      const carousel = carouselRef.current
      if (!carousel) return

      const maxScrollLeft = Math.max(
        0,
        carousel.scrollWidth - carousel.clientWidth,
      )
      const cardStep = getCardStep(carousel)
      const trailingSpace = getTrailingSpace(carousel)
      let targetScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, carousel.scrollLeft + direction * cardStep),
      )
      if (
        direction === 1 &&
        maxScrollLeft - targetScrollLeft <= trailingSpace + SCROLL_TOLERANCE
      ) {
        targetScrollLeft = maxScrollLeft
      }
      if (direction === -1 && targetScrollLeft <= SCROLL_TOLERANCE) {
        targetScrollLeft = 0
      }

      const scrollDelta = targetScrollLeft - carousel.scrollLeft
      if (Math.abs(scrollDelta) <= SCROLL_TOLERANCE) return

      carousel.scrollBy({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        left: scrollDelta,
      })
    },
    [shouldReduceMotion],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollByCard(1)
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollByCard(-1)
      }
    },
    [scrollByCard],
  )

  return {
    carouselRef,
    carouselState,
    handleKeyDown,
    scrollByCard,
  }
}

export const EducationCarousel = () => {
  const { t } = useLingui()
  const carouselId = useId()
  const headingId = `${carouselId}-heading`
  const trackId = `${carouselId}-track`
  const { carouselRef, carouselState, handleKeyDown, scrollByCard } =
    useEducationCarousel()

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-x-clip [contain:inline-size]">
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-[28px] text-foreground leading-[0.96] tracking-[0.28px]"
          id={headingId}
        >
          <Trans>Did You Know?</Trans>
        </h2>
        {carouselState.isScrollable ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-controls={trackId}
              aria-label={t`Previous card`}
              className="flex size-11 items-center justify-center rounded-full text-ens-blue outline-none transition-[color,background-color,transform] duration-150 hover:bg-ens-blue/5 focus-visible:ring-2 focus-visible:ring-ens-blue focus-visible:ring-offset-2 active:scale-95 disabled:text-border disabled:active:scale-100 disabled:hover:bg-transparent"
              disabled={!carouselState.canScrollPrevious}
              onClick={() => scrollByCard(-1)}
              type="button"
            >
              <CircleArrowLeft className="size-8" strokeWidth={1} />
            </button>
            <button
              aria-controls={trackId}
              aria-label={t`Next card`}
              className="flex size-11 items-center justify-center rounded-full text-ens-blue outline-none transition-[color,background-color,transform] duration-150 hover:bg-ens-blue/5 focus-visible:ring-2 focus-visible:ring-ens-blue focus-visible:ring-offset-2 active:scale-95 disabled:text-border disabled:active:scale-100 disabled:hover:bg-transparent"
              disabled={!carouselState.canScrollNext}
              onClick={() => scrollByCard(1)}
              type="button"
            >
              <CircleArrowRight className="size-8" strokeWidth={1} />
            </button>
          </div>
        ) : null}
      </div>

      <section
        aria-labelledby={headingId}
        className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 outline-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ens-blue focus-visible:ring-inset [&::-webkit-scrollbar]:hidden"
        id={trackId}
        onKeyDown={handleKeyDown}
        ref={carouselRef}
        tabIndex={carouselState.isScrollable ? 0 : -1}
      >
        <div className="flex w-full min-w-0 items-stretch">
          {FEATURE_CARDS.map((card, index) => (
            <article
              aria-labelledby={`${carouselId}-card-title-${index}`}
              aria-posinset={index + 1}
              aria-setsize={FEATURE_CARDS.length}
              className={cn(
                // These bases create the approved one-, two-, and three-card density.
                'flex min-w-0 flex-none basis-5/6 flex-col gap-8 overflow-hidden rounded-md p-5 md:basis-[calc((100%-1.25rem)/2)] xl:basis-[calc((100%-2.5rem)/3)]',
                index < FEATURE_CARDS.length - 1 && 'mr-5',
                card.className,
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: Hardcoded list
              key={index}
            >
              <h3
                className="font-medium text-[25px] leading-[0.96] tracking-[-0.5px]"
                id={`${carouselId}-card-title-${index}`}
              >
                {card.title}
              </h3>
              <p className="text-sm leading-none tracking-[-0.28px]">
                {card.description}
              </p>
              <div className="relative isolate mt-auto h-41 w-full overflow-hidden rounded-sm shadow-[0px_10px_14px_0px_rgba(14,61,104,0.06)]">
                <div
                  className="relative h-80 origin-top-left scale-50 select-none"
                  style={{ width: '200%' }}
                >
                  {card.children}
                </div>
              </div>
            </article>
          ))}
          <div aria-hidden="true" className="w-4 flex-none md:w-6 xl:hidden" />
        </div>
      </section>
    </div>
  )
}
