import {
  type IconType,
  SiOpensea,
  SiTelegram,
  SiX,
} from '@icons-pack/react-simple-icons'
import { Trans } from '@lingui/react/macro'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MSymbol } from '@/components/ui/material-symbol'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import {
  buildCommemorativeNftRendererUrl,
  getCommemorativeNftConfig,
} from '../../commemorative-nft/config'
import { CommemorativeNftRendererSurface } from './CommemorativeNftRendererSurface'
import type {
  CommemorativeNftCardData,
  MigrationSuccessDialogState,
} from './MigrationSuccessDialog.types'

type SocialControlProps = {
  readonly href?: string
  readonly icon: IconType
  readonly onClick?: () => void
  readonly children: ReactNode
}

const socialControlClassName =
  'flex size-9 items-center justify-center rounded-full bg-white/[0.88] text-ens-garnet-500 shadow-[0_2px_10px_rgba(90,0,36,0.08)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-white enabled:hover:shadow-[0_4px_14px_rgba(90,0,36,0.13)] disabled:cursor-not-allowed disabled:opacity-45'

type CardDialogState = MigrationSuccessDialogState & {
  readonly card: CommemorativeNftCardData
}

const hasCardData = (
  state: MigrationSuccessDialogState,
): state is CardDialogState => 'card' in state && !!state.card

const SocialControl = ({
  href,
  icon: Icon,
  onClick,
  children,
}: SocialControlProps) => {
  if (href) {
    return (
      <a
        className={socialControlClassName}
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        <Icon aria-hidden className="size-4.5" />
        <span className="sr-only">{children}</span>
      </a>
    )
  }

  return (
    <button
      className={socialControlClassName}
      disabled={!onClick}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden className="size-4.5" />
      <span className="sr-only">{children}</span>
    </button>
  )
}

const SharingRail = ({ state }: { readonly state: CardDialogState }) => {
  const { copy } = useCopyFeedback()
  const externalUrl = state.card.shareUrls.external
  const hasDownload =
    !!state.card.assets.imageUrl || !!state.card.assets.animationUrl

  return (
    <fieldset className="relative z-10 flex shrink-0 flex-col gap-2 border-0 p-0">
      <legend className="sr-only">
        <Trans>NFT actions</Trans>
      </legend>
      <SocialControl href={state.card.shareUrls.x} icon={SiX}>
        <Trans>Share on X</Trans>
      </SocialControl>
      <SocialControl href={state.card.shareUrls.telegram} icon={SiTelegram}>
        <Trans>Share on Telegram</Trans>
      </SocialControl>
      {state.card.marketplaceUrl ? (
        <SocialControl href={state.card.marketplaceUrl} icon={SiOpensea}>
          <Trans>View on OpenSea</Trans>
        </SocialControl>
      ) : null}
      <button
        className={socialControlClassName}
        disabled={!externalUrl}
        onClick={() => externalUrl && void copy(externalUrl)}
        type="button"
      >
        <MSymbol className="ms-wght-500 text-[20px]" symbol="content_copy" />
        <span className="sr-only">
          <Trans>Copy link</Trans>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={socialControlClassName}
            disabled={!hasDownload}
            type="button"
          >
            <MSymbol className="ms-wght-500 text-[20px]" symbol="download" />
            <span className="sr-only">
              <Trans>Download NFT</Trans>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="font-mono">
          <DropdownMenuItem asChild disabled={!state.card.assets.imageUrl}>
            <a
              download
              href={state.card.assets.imageUrl}
              rel="noreferrer"
              target="_blank"
            >
              <MSymbol symbol="image" />
              <Trans>Download PNG</Trans>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={!state.card.assets.animationUrl}>
            <a
              download
              href={state.card.assets.animationUrl}
              rel="noreferrer"
              target="_blank"
            >
              <MSymbol symbol="movie" />
              <Trans>Download MP4</Trans>
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </fieldset>
  )
}

const RenderingCard = () => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex h-[308px] w-[236px] items-center justify-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      key="rendering"
    >
      <div className="relative h-[282px] w-[200px] rotate-[-8.32deg] overflow-hidden rounded-[18px] bg-[#f53293] shadow-[0_4px_22px_white]">
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  rotate: [-3.7, 5.6, 5.6],
                  x: [18, 24, 24],
                  y: [-1, -455, -455],
                  filter: ['blur(55px)', 'blur(25px)', 'blur(25px)'],
                }
          }
          className="absolute top-[298px] left-[-90px] flex h-[180px] w-[314px] items-center justify-center"
          initial={{ rotate: -3.7, x: 18, y: -1, filter: 'blur(55px)' }}
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 2,
                  ease: [0.5, 0, 0.5, 1],
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        >
          <div className="h-[318px] w-[55px] rotate-[66deg] bg-white blur-[50px]" />
        </motion.div>
        <span className="absolute inset-0 flex items-center justify-center font-semi-mono text-[#ff8dc6] text-[11px] uppercase tracking-[0.18em]">
          <Trans>Rendering</Trans>
        </span>
      </div>
    </motion.div>
  )
}

const RevealingCard = ({
  artworkUrl,
  onReady,
}: {
  readonly artworkUrl?: string
  readonly onReady?: () => void
}) => {
  useEffect(() => {
    if (!artworkUrl) onReady?.()
  }, [artworkUrl, onReady])

  return (
    <div className="relative" key="revealing">
      <RenderingCard />
      {artworkUrl ? (
        <img
          alt=""
          aria-hidden
          className="pointer-events-none absolute size-px opacity-0"
          onError={onReady}
          onLoad={onReady}
          src={artworkUrl}
        />
      ) : null}
    </div>
  )
}

const ArtworkCard = ({
  state,
  onRevealComplete,
}: {
  readonly state: CardDialogState
  readonly onRevealComplete?: () => void
}) => {
  const rendererUrl = buildCommemorativeNftRendererUrl({
    eligibility: state.card.eligibility,
    rendererOrigin: getCommemorativeNftConfig().rendererOrigin,
  })

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Commemorative ENS NFT for ${state.card.eligibility.rendererName}`}
      className="flex h-[308px] w-[236px] items-center justify-center"
      initial={{ opacity: 0, y: 8 }}
      key="artwork"
      role="group"
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative h-[282px] w-[200px] rotate-[-5.12deg] bg-transparent drop-shadow-[0_7px_7px_rgba(90,0,36,0.28)]">
        <CommemorativeNftRendererSurface
          artworkUrl={state.card.artworkUrl}
          eligibility={state.card.eligibility}
          key={rendererUrl}
          onReady={onRevealComplete}
          rendererUrl={rendererUrl}
        />
      </div>
    </motion.div>
  )
}

export const CommemorativeNftCard = ({
  state,
  onRevealComplete,
}: {
  readonly state: MigrationSuccessDialogState
  readonly onRevealComplete?: () => void
}) => {
  const cardState = hasCardData(state) ? state : undefined

  return (
    <div className="flex h-[308px] w-full items-center justify-center gap-3">
      <AnimatePresence initial={false} mode="wait">
        {cardState ? (
          cardState.status === 'revealing' ? (
            <RevealingCard
              artworkUrl={cardState.card.artworkUrl}
              key="revealing"
              onReady={onRevealComplete}
            />
          ) : (
            <ArtworkCard
              key="artwork"
              onRevealComplete={onRevealComplete}
              state={cardState}
            />
          )
        ) : (
          <RenderingCard key="rendering" />
        )}
      </AnimatePresence>
      {cardState && cardState.status !== 'revealing' ? (
        <SharingRail state={cardState} />
      ) : null}
    </div>
  )
}
