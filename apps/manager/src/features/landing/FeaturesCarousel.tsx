import { Trans, useLingui } from '@lingui/react/macro'
import clsx from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import type { ComponentProps, ReactNode } from 'react'
import { useRef, useState } from 'react'
import card_1_1 from '@/assets/pages/landing/card-1-1.webp'
import card_1_2 from '@/assets/pages/landing/card-1-2.webp'
import card_1_3 from '@/assets/pages/landing/card-1-3.webp'
import { cn } from '@/lib/utils'
import { tw } from '@/utils/tailwind'
import { BgPattern, ChatBubble, Sparkle } from './components/primitives'

type FeatureCard = {
  title: ReactNode
  description: ReactNode
  className?: string
  indicatorClass: string
  children: ReactNode
}

export const FEATURE_CARDS: FeatureCard[] = [
  {
    className: tw`bg-ens-peridot-dust text-ens-peridot-core`,
    indicatorClass: tw`border-ens-peridot-core data-active:bg-ens-peridot-core`,
    title: <Trans>One username everywhere</Trans>,
    description: (
      <Trans>
        Your name lives onchain - you own it, not a platform. Sign in to web3
        apps with your <span className="font-medium font-sans">.eth name</span>{' '}
        and your ENS profile will load automatically.
      </Trans>
    ),
    children: (
      <>
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-sm">
          <BgPattern className="opacity-90" />
          <div className="absolute inset-0 bg-linear-130 from-25% from-[#e4e5e4cc] to-110% to-[#92ad9acc]"></div>
        </div>

        <img
          alt="card-1-2"
          className="pointer-events-none absolute -bottom-2 left-8 w-64 max-sm:hidden md:left-[10%] lg:bottom-3 lg:left-[27.5%]"
          src={card_1_2}
        />
        <img
          alt="card-1-1"
          className="pointer-events-none absolute -top-7 -left-8 w-58 sm:top-4 sm:left-5.5 md:top-5.5 lg:w-64"
          src={card_1_1}
        />
        <img
          alt="card-1-3"
          className="pointer-events-none absolute -right-5 -bottom-20 w-58 sm:right-4 sm:bottom-12 lg:w-64"
          src={card_1_3}
        />
      </>
    ),
  },
  {
    className: tw`bg-ens-garnet-dust text-ens-garnet-core`,
    indicatorClass: tw`border-ens-garnet-core data-active:bg-ens-garnet-core`,
    title: <Trans>Verify authenticity and stay safe.</Trans>,
    description: (
      <Trans>
        Companies and projects use ENS because it's secured by ethereum, so you
        can be sure it's the real deal. Avoid impersonation scams and stay safe
        out there &lt;3.
      </Trans>
    ),
    children: (
      <>
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-sm">
          <BgPattern className="opacity-90" />
          <div className="absolute inset-0 bg-linear-290 from-55% from-[#FFEFF6CC] to-130% to-[#F886B64D] opacity-90" />
        </div>

        <div className="absolute inset-4 flex flex-col gap-4 sm:inset-6">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-full bg-ens-garnet-surface md:size-11"></div>
              <div className="rounded-md bg-ens-garnet-dense p-1.5 font-medium text-sm text-white leading-ens-tight sm:p-2 sm:text-base">
                support.company.eth
              </div>
            </div>

            <ChatBubble>
              <Trans>Can you share your order number?</Trans>
            </ChatBubble>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-end gap-2">
              <div className="size-9 rounded-full bg-ens-garnet-surface md:size-11"></div>
              <div className="rounded-md bg-ens-garnet-dense p-1.5 font-medium text-sm text-white leading-ens-tight sm:p-2 sm:text-base">
                you.eth
              </div>
            </div>

            <ChatBubble kind="reply">
              <Trans>
                No problem. I just checked your
                <br />
                ENS profile, you're legit! It's HGJLY ☺️
              </Trans>
            </ChatBubble>
          </div>
        </div>
      </>
    ),
  },
  {
    className: tw`bg-ens-lapis-dust text-ens-lapis-core`,
    indicatorClass: tw`border-ens-lapis-core data-active:bg-ens-lapis-core`,
    title: <Trans>A simpler way to get paid.</Trans>,
    description: (
      <Trans>
        Your ENS name replaces your wallet addresses so friends and clients can
        send money to <span className="font-medium font-sans">friend.eth</span>{' '}
        instead of a confusing jumble of letters and numbers.
      </Trans>
    ),
    children: (
      <>
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-sm">
          <BgPattern className="opacity-30" />
          <div className="absolute inset-0 bg-linear-125 from-22% from-[#FEFEFE00] to-63% to-[#EDF1F2] opacity-80" />
        </div>

        <div className="absolute top-10 left-10 w-1/3 max-w-3xs">
          <div className="relative rounded-md bg-ens-blue-midnight/50 p-3 md:p-4">
            <span className="block w-full bg-linear-90 from-white to-transparent bg-clip-text font-medium font-semi-mono text-transparent text-xs md:text-sm">
              0x0b08dA7068b73A579Bd5E8a8290f
            </span>
            <span className="-translate-1/2 absolute top-0 left-0 text-[28px] leading-none md:text-[32px]">
              🫣
            </span>
            <span className="absolute top-1/2 right-0 translate-x-[115%] -translate-y-1/2 text-[32px] leading-none md:text-[42px]">
              🫷
            </span>
          </div>
        </div>

        <div className="-translate-1/2 absolute top-[55%] left-1/2">
          <div className="relative rounded-md bg-linear-90 from-ens-blue to-[#21B8FF] p-3 md:p-5">
            {/* Five randomly placed sparkles */}
            <Sparkle className="absolute -top-8 -left-13 max-md:h-8 md:-left-20" />
            <Sparkle className="absolute -bottom-7 -left-8 max-md:h-8 md:-bottom-12 md:-left-12" />
            <Sparkle className="absolute -top-2 -right-14 max-md:h-8 md:-top-8 md:-right-20" />
            <Sparkle className="absolute -right-4 -bottom-12 rotate-180 max-md:h-8 md:-right-12 md:-bottom-14" />
            <Sparkle className="absolute -right-11 -bottom-17 max-md:h-8 md:-right-32 md:-bottom-20" />

            <span className="block w-full font-medium font-semi-mono text-lg text-white md:text-[28px]">
              friend.eth
            </span>
            <span className="-translate-1/2 absolute top-0 left-0 text-[28px] leading-none md:text-[44px]">
              😌
            </span>
            <span className="absolute top-1/2 right-0 translate-x-5/6 -translate-y-1/2 text-[28px] leading-none md:text-[44px]">
              🫶
            </span>
          </div>
        </div>
      </>
    ),
  },
]

const CarouselCard = ({
  data: { title, description },
  children,
  className,
  style,
  ...props
}: {
  data: {
    title: ReactNode
    description: ReactNode
  }
  children: ReactNode
} & ComponentProps<typeof motion.div>) => {
  const x = useMotionValue(0)
  const scale = useTransform(x, [-300, 0, 300], [0.9, 1, 0.9])
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12])

  return (
    <motion.div
      className={cn(
        'flex flex-none flex-col justify-between overflow-hidden rounded-lg p-4 lg:p-5.5',
        className,
      )}
      style={{
        x,
        scale,
        rotate,
        ...style,
      }}
      {...props}
    >
      <div className="space-y-4">
        <h2 className="font-bold text-2xl leading-ens-none lg:text-temp-32px">
          {title}
        </h2>
        <p className="max-w-87.5 font-normal font-serif text-sm leading-none lg:text-base">
          {description}
        </p>
      </div>

      <div className="relative isolate mt-10 h-80 select-none justify-self-end lg:mt-4">
        {children}
      </div>
    </motion.div>
  )
}

export const FeaturesCarousel = () => {
  const { t } = useLingui()
  const [offset, setOffset] = useState(0)
  const constraintRef = useRef<HTMLDivElement>(null)

  function incrementOffset() {
    setOffset((offset + 1) % FEATURE_CARDS.length)
  }
  function decrementOffset() {
    setOffset((offset - 1 + FEATURE_CARDS.length) % FEATURE_CARDS.length)
  }

  return (
    <div className="relative isolate mt-15 lg:mt-28">
      <div className="relative mx-auto w-full-[2rem] max-w-6xl">
        <div
          className="relative flex w-full [--s2-basis:90%] md:[--s2-basis:80%] xl:[--s2-basis:70%]"
          ref={constraintRef}
        >
          {FEATURE_CARDS.map(({ children, className, ...data }, index) => {
            const cardIndex =
              (index - offset + FEATURE_CARDS.length) % FEATURE_CARDS.length
            return (
              <CarouselCard
                className={clsx(className, 'basis-(--s2-basis)')}
                data={data}
                drag={cardIndex === 0 ? 'x' : false}
                dragConstraints={{
                  left: 0,
                  right: 0,
                }}
                // biome-ignore lint/suspicious/noArrayIndexKey: Hardcoded list
                key={index}
                layout="position"
                onClick={() => setOffset(index)}
                onDragEnd={(_, info) => {
                  const constraintWidth =
                    constraintRef.current?.getBoundingClientRect().width ?? 0
                  const threshold = 0.125 * constraintWidth

                  if (
                    Math.abs(info.velocity.x) >= 50 ||
                    Math.abs(info.offset.x) > threshold
                  ) {
                    incrementOffset()
                  }
                }}
                style={{
                  zIndex: FEATURE_CARDS.length - cardIndex,
                  order: cardIndex,
                  position: 'relative',
                  right:
                    cardIndex === 0
                      ? undefined
                      : `calc((var(--s2-basis) - (100% - var(--s2-basis)) / ${FEATURE_CARDS.length - 1}) * ${cardIndex})`,
                }}
              >
                {children}
              </CarouselCard>
            )
          })}
        </div>
        {/* Prev button, dots for each slide, next button */}
        <div className="my-9 flex items-center justify-center gap-4 pb-4">
          <button
            aria-label={t`Previous slide`}
            onClick={decrementOffset}
            type="button"
          >
            <ChevronLeftIcon className="size-6" />
          </button>
          <div className="flex items-center justify-center gap-2">
            {FEATURE_CARDS.map(({ indicatorClass }, index) => {
              return (
                <button
                  aria-label={t`Go to slide ${index + 1}`}
                  className={clsx(
                    'size-4 rounded-xs border-2 bg-transparent transition-colors',
                    indicatorClass,
                  )}
                  data-active={index === offset ? true : undefined}
                  // biome-ignore lint/suspicious/noArrayIndexKey: Hardcoded list
                  key={index}
                  onClick={() => setOffset(index)}
                  type="button"
                ></button>
              )
            })}
          </div>
          <button
            aria-label={t`Next slide`}
            onClick={incrementOffset}
            type="button"
          >
            <ChevronRightIcon className="size-6" />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 top-1/2 bottom-0 -z-10 bg-white"></div>
    </div>
  )
}
