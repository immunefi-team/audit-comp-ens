import { Copy } from 'lucide-react'
import { motion } from 'motion/react'
import {
  type MaterialSymbolProps,
  MSymbol,
} from '@/components/ui/material-symbol'
import { getLoadingHeaderCover } from '@/features/profile/utils/defaultHeaderCover'
import { cn } from '@/lib/utils'
import { tw } from '@/utils/tailwind'
import { getMotionProps, SkeletonBlock } from './ProfileLoadingPrimitives'

const neutralAvatarCellIds = Array.from({ length: 36 }, (_, index) => index)
const neutralAvatarFilledCells = new Set([
  0, 2, 4, 6, 12, 18, 24, 30, 31, 32, 33, 34, 35, 11, 15, 16, 20, 22, 27, 28,
])
const loadingHeaderCoverUrl = getLoadingHeaderCover()

export const ProfileBannerLoading = ({
  shouldReduceMotion,
}: {
  readonly shouldReduceMotion: boolean
}) => (
  <div className="relative h-74 w-full lg:landscape:h-90.25">
    <div className="absolute inset-0 overflow-hidden">
      <img
        alt=""
        aria-hidden="true"
        className="absolute top-14 h-60 w-full object-cover lg:landscape:top-0 lg:landscape:h-130"
        src={loadingHeaderCoverUrl}
      />
      {!shouldReduceMotion && (
        <div className="pointer-events-none absolute top-14 h-60 w-full animate-shimmer bg-linear-to-r from-transparent via-white/30 to-transparent lg:landscape:top-0 lg:landscape:h-130" />
      )}
    </div>
    <div className="mask-[linear-gradient(to_bottom,transparent_0%,transparent_54%,black_78%,black_100%)] pointer-events-none absolute inset-x-0 -bottom-10 h-62.5 bg-[linear-gradient(to_bottom,rgba(252,251,251,0)_0%,rgba(252,251,251,0)_40%,rgba(252,251,251,0.72)_72%,#FCFBFB_100%)] backdrop-blur-sm" />
  </div>
)

const NeutralAvatarLoading = ({
  className,
  shouldReduceMotion,
}: {
  readonly className?: string
  readonly shouldReduceMotion: boolean
}) => (
  <div
    className={cn(
      'relative size-45.5 shrink-0 overflow-hidden rounded-[18.889px] bg-ens-quartz-100 p-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
      className,
    )}
  >
    <div className="grid size-full grid-cols-6 grid-rows-6 gap-1.5">
      {neutralAvatarCellIds.map((cellId) => (
        <div
          className={tw(
            'rounded-xs',
            neutralAvatarFilledCells.has(cellId)
              ? 'bg-ens-quartz-300'
              : 'bg-ens-quartz-200/45',
          )}
          key={`avatar-cell-${cellId}`}
        />
      ))}
    </div>
    {shouldReduceMotion ? null : (
      <div className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/30 to-transparent" />
    )}
  </div>
)

const ProfileNameBadgeLoading = ({
  name,
  shouldReduceMotion,
}: {
  readonly name?: string
  readonly shouldReduceMotion: boolean
}) => (
  <div
    className={tw(
      'relative inline-flex max-w-full items-center overflow-hidden rounded-[3px] px-3 py-1.5',
      name ? 'bg-ens-quartz-700 text-white' : 'bg-ens-quartz-200',
    )}
  >
    {name ? (
      <h1 className="truncate font-semi-mono text-[32px] leading-[1.12]">
        {name}
      </h1>
    ) : (
      <div className="h-[35.84px] w-56" />
    )}
    {shouldReduceMotion ? null : (
      <div className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/15 to-transparent" />
    )}
  </div>
)

const ProfileDetailLoading = ({
  hasCopy,
  iconGapClassName = 'gap-3',
  label,
  shouldReduceMotion,
  symbol,
  valueWidth,
}: {
  readonly hasCopy?: boolean
  readonly iconGapClassName?: string
  readonly label: string
  readonly shouldReduceMotion: boolean
  readonly symbol: MaterialSymbolProps['symbol']
  readonly valueWidth: string
}) => (
  <div className="flex min-w-0 flex-col items-start gap-0 lg:landscape:flex-row lg:landscape:items-center lg:landscape:gap-1.5">
    <div
      className={cn(
        'flex items-center text-ens-quartz-400 text-xs leading-5.25 lg:landscape:text-base lg:landscape:leading-normal',
        iconGapClassName,
      )}
    >
      <MSymbol className="ms-opsz-20 ms-wght-300 shrink-0" symbol={symbol} />
      <span>{label}</span>
    </div>
    <div className="flex min-w-0 items-center gap-1 pl-6 lg:landscape:pl-0">
      <SkeletonBlock
        className={tw('h-4.5 rounded-sm lg:landscape:h-5', valueWidth)}
        shouldReduceMotion={shouldReduceMotion}
      />
      {hasCopy ? (
        <Copy className="size-3.5 shrink-0 text-ens-quartz-400 lg:landscape:size-4" />
      ) : null}
    </div>
  </div>
)

export const ProfileHeaderLoading = ({
  name,
  shouldReduceMotion,
}: {
  readonly name?: string
  readonly shouldReduceMotion: boolean
}) => (
  <motion.div
    className="relative min-h-130.75 rounded-none bg-transparent pt-15.5 shadow-none lg:landscape:min-h-0 lg:landscape:space-y-[21.7px] lg:landscape:px-8 lg:landscape:pt-0"
    {...getMotionProps(shouldReduceMotion)}
  >
    <NeutralAvatarLoading
      className="absolute -top-33 left-1/2 size-45.5 -translate-x-1/2 rounded-[18.889px] bg-ens-quartz-100 shadow-[0_4px_16px_rgba(0,0,0,0.12)] lg:landscape:hidden"
      shouldReduceMotion={shouldReduceMotion}
    />
    <div className="flex flex-col items-center lg:landscape:block lg:landscape:space-y-3.25">
      <ProfileNameBadgeLoading
        name={name}
        shouldReduceMotion={shouldReduceMotion}
      />
      <div className="mt-10 w-full px-5 lg:landscape:mt-0 lg:landscape:px-0">
        <div className="grid w-full grid-cols-3 gap-3 lg:landscape:flex lg:landscape:max-w-full lg:landscape:flex-wrap lg:landscape:items-center lg:landscape:gap-x-6 lg:landscape:gap-y-3">
          <ProfileDetailLoading
            hasCopy
            iconGapClassName="gap-0.5"
            label="Owner"
            shouldReduceMotion={shouldReduceMotion}
            symbol="key_vertical"
            valueWidth="w-15 lg:landscape:w-21"
          />
          <ProfileDetailLoading
            label="Registered"
            shouldReduceMotion={shouldReduceMotion}
            symbol="calendar_clock"
            valueWidth="w-14 lg:landscape:w-28"
          />
          <ProfileDetailLoading
            label="Expires"
            shouldReduceMotion={shouldReduceMotion}
            symbol="history"
            valueWidth="w-14 lg:landscape:w-28"
          />
        </div>
      </div>
      <div className="mt-6 w-[calc(100%-40px)] border-ens-quartz-200 border-t lg:landscape:hidden" />
    </div>

    <div className="mt-29 flex flex-col gap-6 px-5 lg:landscape:mt-0 lg:landscape:flex-row lg:landscape:items-stretch lg:landscape:px-0">
      <NeutralAvatarLoading
        className="hidden size-45.5 shrink-0 rounded-[18.889px] bg-ens-quartz-100 shadow-[0_4px_16px_rgba(0,0,0,0.12)] lg:landscape:block"
        shouldReduceMotion={shouldReduceMotion}
      />
      <div className="flex min-h-0 flex-1 rounded-none border-none bg-transparent p-0 shadow-none lg:landscape:min-h-45.5 lg:landscape:max-w-158.75 lg:landscape:rounded-xl lg:landscape:border-[0.25px] lg:landscape:border-ens-quartz-300 lg:landscape:bg-white lg:landscape:p-6 lg:landscape:shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <div className="grid w-full gap-8 lg:landscape:grid-cols-[minmax(0,346.5px)_228px] lg:landscape:gap-3">
          <div className="min-w-0">
            <SkeletonBlock
              className="h-5 w-16"
              shouldReduceMotion={shouldReduceMotion}
            />
            <div className="mt-4 space-y-3">
              <SkeletonBlock
                className="h-4 w-full"
                shouldReduceMotion={shouldReduceMotion}
              />
              <SkeletonBlock
                className="h-4 w-5/6"
                shouldReduceMotion={shouldReduceMotion}
              />
              <SkeletonBlock
                className="h-4 w-2/3"
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-4 lg:landscape:flex lg:landscape:flex-col lg:landscape:justify-start lg:landscape:gap-1.5">
            {['timezone', 'language', 'location'].map((id, index) => (
              <div
                className="flex min-w-0 items-start gap-1 lg:landscape:items-center"
                key={id}
              >
                <SkeletonBlock
                  className="size-5 shrink-0 rounded lg:landscape:size-6"
                  shouldReduceMotion={shouldReduceMotion}
                />
                <SkeletonBlock
                  className={tw(
                    'h-5',
                    index === 0 ? 'w-36' : index === 1 ? 'w-24' : 'w-28',
                  )}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </motion.div>
)
