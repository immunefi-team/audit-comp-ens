import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { tw } from '@/utils/tailwind'
import type { CommemorativeNftEligibility } from '../../commemorative-nft/types'

const RENDERER_PAINT_SETTLE_MS = 300

type CommemorativeNftRendererSurfaceProps = {
  readonly artworkUrl?: string
  readonly eligibility: CommemorativeNftEligibility
  readonly onReady?: () => void
  readonly rendererUrl?: string
}

const isRendererDocumentLoad = (iframe: HTMLIFrameElement) => {
  try {
    return iframe.contentWindow?.location.href !== 'about:blank'
  } catch {
    // Reading the URL throws once the deployed cross-origin renderer has loaded.
    return true
  }
}

export const CommemorativeNftRendererSurface = ({
  artworkUrl,
  eligibility,
  onReady,
  rendererUrl,
}: CommemorativeNftRendererSurfaceProps) => {
  const shouldReduceMotion = useReducedMotion()
  const onReadyRef = useRef(onReady)
  const [artworkFailed, setArtworkFailed] = useState(false)
  const [rendererFailed, setRendererFailed] = useState(false)
  const [rendererLoaded, setRendererLoaded] = useState(false)
  const [rendererReady, setRendererReady] = useState(false)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!rendererUrl && !artworkUrl) onReadyRef.current?.()
  }, [artworkUrl, rendererUrl])

  useEffect(() => {
    if (!rendererLoaded || rendererFailed) return

    let firstAnimationFrame: number | undefined
    let secondAnimationFrame: number | undefined
    const settleTimer = window.setTimeout(() => {
      firstAnimationFrame = window.requestAnimationFrame(() => {
        secondAnimationFrame = window.requestAnimationFrame(() => {
          setRendererReady(true)
          onReadyRef.current?.()
        })
      })
    }, RENDERER_PAINT_SETTLE_MS)

    return () => {
      window.clearTimeout(settleTimer)
      if (firstAnimationFrame !== undefined)
        window.cancelAnimationFrame(firstAnimationFrame)
      if (secondAnimationFrame !== undefined)
        window.cancelAnimationFrame(secondAnimationFrame)
    }
  }, [rendererFailed, rendererLoaded])

  const fallback = (
    <div className="absolute inset-0 z-10 overflow-hidden rounded-[18px]">
      {artworkUrl && !artworkFailed ? (
        <img
          alt=""
          className="pointer-events-none absolute top-0 left-[-7.03%] h-full w-[141.41%] max-w-none select-none object-cover"
          draggable={false}
          onError={() => {
            setArtworkFailed(true)
            if (!rendererUrl) onReady?.()
          }}
          onLoad={() => {
            if (!rendererUrl) onReady?.()
          }}
          src={artworkUrl}
        />
      ) : (
        <div
          aria-label={`Loading commemorative NFT preview for ${eligibility.rendererName}`}
          aria-live="polite"
          className="absolute inset-0 bg-[#f1d5e1]"
          data-archetype={eligibility.traits.Archetype}
          data-seed={eligibility.traits.Seed}
          role="status"
        >
          <div className="absolute inset-0 bg-linear-to-br from-white/50 via-[#f6dce7] to-[#eec7d8]" />
          {shouldReduceMotion ? null : (
            <div className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/70 to-transparent" />
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {rendererReady && !rendererFailed ? null : fallback}
      {rendererUrl && !rendererFailed ? (
        <iframe
          className={tw(
            'absolute top-1/2 left-1/2 z-0 h-full w-[109%] -translate-x-1/2 -translate-y-1/2 scale-[1.15] border-0',
            rendererReady ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onError={() => {
            setRendererFailed(true)
            onReadyRef.current?.()
          }}
          onLoad={(event) => {
            if (!isRendererDocumentLoad(event.currentTarget)) return
            setRendererLoaded(true)
          }}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          src={rendererUrl}
          tabIndex={-1}
          title={`Interactive commemorative NFT artwork for ${eligibility.rendererName}`}
        />
      ) : null}
    </>
  )
}
