import { Loader2 } from 'lucide-react'
import type React from 'react'
import { useRef } from 'react'
import { MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'
import { getCropBaseScale, getCropViewportSize } from './ProfileImageField.crop'
import { focusVisibleRingClassName } from './ProfileImageField.helpers'
import type {
  ProfileImageCropOffset,
  ProfileImageKind,
  ProfileImageSize,
} from './ProfileImageField.types'
import { ErrorMessage } from './ProfileImageFieldPanels'
import { ImagePickerPanel } from './ProfileImageFieldSteps'

const MIN_CROP_ZOOM = 1
const MAX_CROP_ZOOM = 3
const CROP_ZOOM_STEP = 0.01

interface UploadCropStepProps {
  readonly cropImageSize: ProfileImageSize | null
  readonly cropOffset: ProfileImageCropOffset
  readonly cropZoom: number
  readonly disabled?: boolean
  readonly error: string | null
  readonly isCropping: boolean
  readonly isUploading: boolean
  readonly kind: ProfileImageKind
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly onCropImageLoad: (size: ProfileImageSize) => void
  readonly onCropOffsetChange: (offset: ProfileImageCropOffset) => void
  readonly onCropZoomChange: (zoom: number) => void
  readonly uploadFile: File | null
  readonly uploadPreviewUrl: string | null
}

interface DragState {
  readonly origin: ProfileImageCropOffset
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
}

export const UploadCropStep = ({
  cropImageSize,
  cropOffset,
  cropZoom,
  disabled,
  error,
  isCropping,
  isUploading,
  kind,
  onBack,
  onConfirm,
  onCropImageLoad,
  onCropOffsetChange,
  onCropZoomChange,
  uploadFile,
  uploadPreviewUrl,
}: UploadCropStepProps) => {
  const dragStateRef = useRef<DragState | null>(null)
  const isProcessing = isCropping || isUploading
  const processingLabel = isUploading ? 'Uploading' : 'Processing'
  const viewportSize = getCropViewportSize(kind)
  const baseScale = cropImageSize
    ? getCropBaseScale({ imageSize: cropImageSize, viewportSize })
    : 1
  const cropImageStyle = cropImageSize
    ? {
        height: cropImageSize.height * baseScale,
        transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
        width: cropImageSize.width * baseScale,
      }
    : {
        transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
      }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isProcessing) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      origin: cropOffset,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    onCropOffsetChange({
      x: dragState.origin.x + event.clientX - dragState.startX,
      y: dragState.origin.y + event.clientY - dragState.startY,
    })
  }

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return
    dragStateRef.current = null
  }

  return (
    <ImagePickerPanel
      backDisabled={disabled || isProcessing}
      className="min-h-82.5 p-4"
      contentClassName="max-w-95 gap-2.5"
      onBack={onBack}
    >
      <p className="text-base text-ens-quartz-500 leading-ens-normal">
        Edit image
      </p>
      <div
        className="relative flex touch-none select-none items-center justify-center overflow-hidden rounded-xl border border-ens-quartz-350 bg-ens-quartz-50"
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        style={{
          height: viewportSize.height,
          width: viewportSize.width,
        }}
      >
        {uploadPreviewUrl ? (
          <img
            alt="Uploaded preview"
            className="absolute top-1/2 left-1/2 max-w-none cursor-grab object-cover active:cursor-grabbing"
            draggable={false}
            onLoad={(event) =>
              onCropImageLoad({
                height: event.currentTarget.naturalHeight,
                width: event.currentTarget.naturalWidth,
              })
            }
            src={uploadPreviewUrl}
            style={cropImageStyle}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-center gap-0.5 p-1 text-black">
        <MSymbol
          aria-hidden="true"
          className="ms-wght-300"
          style={{ fontSize: 20 }}
          symbol="zoom_out"
        />
        <input
          aria-label="Zoom image"
          className="h-7 w-33 cursor-pointer accent-ens-lapis-500 disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled || isProcessing || !cropImageSize}
          max={MAX_CROP_ZOOM}
          min={MIN_CROP_ZOOM}
          onChange={(event) => onCropZoomChange(Number(event.target.value))}
          step={CROP_ZOOM_STEP}
          type="range"
          value={cropZoom}
        />
        <MSymbol
          aria-hidden="true"
          className="ms-wght-300"
          style={{ fontSize: 20 }}
          symbol="zoom_in"
        />
      </div>
      <button
        className={cn(
          'flex h-12.5 items-center justify-center rounded-sm bg-ens-lapis-100 px-6 font-mono text-ens-lapis-500 text-xs uppercase tracking-widest transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50',
          focusVisibleRingClassName,
        )}
        disabled={disabled || isProcessing || !uploadFile || !cropImageSize}
        onClick={onConfirm}
        type="button"
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {processingLabel}
          </span>
        ) : (
          'Confirm edit'
        )}
      </button>
      <ErrorMessage error={error} />
    </ImagePickerPanel>
  )
}
