import { Trans } from '@lingui/react/macro'
import type { HTMLAttributes } from 'react'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

type ImageFallbackContextValue = {
  imageLoadingStatus: ImageLoadingStatus
  onImageLoadingStatusChange(status: ImageLoadingStatus): void
}

const ImageFallbackContext = createContext<ImageFallbackContextValue | null>(
  null,
)

const useImageFallbackContext = (componentName: string) => {
  const context = useContext(ImageFallbackContext)
  if (!context) {
    throw new Error(`${componentName} must be used within ImageFallback.Root`)
  }
  return context
}

// -------------------------------------------------------------------------------------------------
// Image loading status detection (inspired by Radix)
// -------------------------------------------------------------------------------------------------

function resolveLoadingStatus(
  image: HTMLImageElement | null,
  src?: string,
): ImageLoadingStatus {
  if (!image) {
    return 'idle'
  }
  if (!src) {
    return 'error'
  }
  if (image.src !== src) {
    image.src = src
  }
  return image.complete && image.naturalWidth > 0 ? 'loaded' : 'loading'
}

function useImageLoadingStatus(src: string | undefined) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>(() =>
    resolveLoadingStatus(imageRef.current, src),
  )

  useLayoutEffect(() => {
    if (!imageRef.current) {
      imageRef.current = new window.Image()
    }
    setLoadingStatus(resolveLoadingStatus(imageRef.current, src))
  }, [src])

  useLayoutEffect(() => {
    const updateStatus = (status: ImageLoadingStatus) => () => {
      setLoadingStatus(status)
    }

    if (!imageRef.current) {
      imageRef.current = new window.Image()
    }

    const image = imageRef.current
    const handleLoad = updateStatus('loaded')
    const handleError = updateStatus('error')

    image.addEventListener('load', handleLoad)
    image.addEventListener('error', handleError)

    return () => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
    }
  }, [])

  return loadingStatus
}

// -------------------------------------------------------------------------------------------------
// Root
// -------------------------------------------------------------------------------------------------

export interface RootProps extends HTMLAttributes<HTMLDivElement> {}

const ImageFallback = forwardRef<HTMLDivElement, RootProps>(
  ({ className, ...props }, ref) => {
    const [imageLoadingStatus, setImageLoadingStatus] =
      useState<ImageLoadingStatus>('idle')

    const onImageLoadingStatusChange = useCallback(
      (status: ImageLoadingStatus) => {
        setImageLoadingStatus(status)
      },
      [],
    )

    return (
      <ImageFallbackContext.Provider
        value={{
          imageLoadingStatus,
          onImageLoadingStatusChange,
        }}
      >
        <div className={className ?? 'contents'} ref={ref} {...props} />
      </ImageFallbackContext.Provider>
    )
  },
)

ImageFallback.displayName = 'ImageFallback.Root'

// -------------------------------------------------------------------------------------------------
// Image
// -------------------------------------------------------------------------------------------------

export interface ImageProps extends HTMLAttributes<HTMLImageElement> {
  src?: string
  alt?: string
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void
}

const ImageFallbackImage = forwardRef<HTMLImageElement, ImageProps>(
  (
    { src, alt = '', onLoadingStatusChange = () => {}, className, ...props },
    ref,
  ) => {
    const context = useImageFallbackContext('ImageFallback.Image')
    const imageLoadingStatus = useImageLoadingStatus(src)

    const handleLoadingStatusChange = useCallback(
      (status: ImageLoadingStatus) => {
        onLoadingStatusChange(status)
        context.onImageLoadingStatusChange(status)
      },
      [context, onLoadingStatusChange],
    )

    useLayoutEffect(() => {
      if (imageLoadingStatus !== 'idle') {
        handleLoadingStatusChange(imageLoadingStatus)
      }
    }, [imageLoadingStatus, handleLoadingStatusChange])

    return imageLoadingStatus === 'loaded' ? (
      <img alt={alt} className={className} ref={ref} src={src} {...props} />
    ) : null
  },
)

ImageFallbackImage.displayName = 'ImageFallback.Image'

// -------------------------------------------------------------------------------------------------
// Fallback
// -------------------------------------------------------------------------------------------------

export interface FallbackProps extends HTMLAttributes<HTMLDivElement> {
  delayMs?: number
}

const ImageFallbackFallback = forwardRef<HTMLDivElement, FallbackProps>(
  ({ delayMs, className, children, ...props }, ref) => {
    const context = useImageFallbackContext('ImageFallback.Fallback')
    const [canRender, setCanRender] = useState(delayMs === undefined)

    useLayoutEffect(() => {
      if (delayMs !== undefined) {
        const timerId = window.setTimeout(() => setCanRender(true), delayMs)
        return () => window.clearTimeout(timerId)
      }
    }, [delayMs])

    const shouldShowFallback =
      canRender && context.imageLoadingStatus !== 'loaded'

    return shouldShowFallback ? (
      <div className={className ?? 'contents'} ref={ref} {...props}>
        {children || (
          <div>
            <Trans>Image not available</Trans>
          </div>
        )}
      </div>
    ) : null
  },
)

ImageFallbackFallback.displayName = 'ImageFallback.Fallback'

// -------------------------------------------------------------------------------------------------
// Loading
// -------------------------------------------------------------------------------------------------

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {}

const ImageFallbackLoading = forwardRef<HTMLDivElement, LoadingProps>(
  ({ className, children, ...props }, ref) => {
    const context = useImageFallbackContext('ImageFallback.Loading')
    const shouldShowLoading = context.imageLoadingStatus === 'loading'

    return shouldShowLoading ? (
      <div className={className} ref={ref} {...props}>
        {children || (
          <div>
            <Trans>Loading...</Trans>
          </div>
        )}
      </div>
    ) : null
  },
)

ImageFallbackLoading.displayName = 'ImageFallback.Loading'

const Root = ImageFallback
const Image = ImageFallbackImage
const Fallback = ImageFallbackFallback
const Loading = ImageFallbackLoading

export {
  Fallback,
  Image,
  //
  ImageFallback,
  ImageFallbackFallback,
  ImageFallbackImage,
  ImageFallbackLoading,
  Loading,
  //
  Root,
}
