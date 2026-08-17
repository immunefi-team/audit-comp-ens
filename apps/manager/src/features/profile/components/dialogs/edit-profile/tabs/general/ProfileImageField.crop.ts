import type {
  ProfileImageCropOffset,
  ProfileImageKind,
  ProfileImageSize,
} from './ProfileImageField.types'

const CROP_OUTPUT_SCALE = 4
const CROP_JPEG_QUALITY = 0.92
const AVATAR_CROP_VIEWPORT_SIZE = {
  height: 168,
  width: 168,
} as const satisfies ProfileImageSize
const HEADER_CROP_VIEWPORT_SIZE = {
  height: 126,
  width: 340,
} as const satisfies ProfileImageSize

export const getCropViewportSize = (
  kind: ProfileImageKind,
): ProfileImageSize =>
  kind === 'avatar' ? AVATAR_CROP_VIEWPORT_SIZE : HEADER_CROP_VIEWPORT_SIZE

export const getCropBaseScale = ({
  imageSize,
  viewportSize,
}: {
  readonly imageSize: ProfileImageSize
  readonly viewportSize: ProfileImageSize
}) =>
  Math.max(
    viewportSize.width / imageSize.width,
    viewportSize.height / imageSize.height,
  )

export const getConstrainedCropOffset = ({
  imageSize,
  offset,
  viewportSize,
  zoom,
}: {
  readonly imageSize: ProfileImageSize | null
  readonly offset: ProfileImageCropOffset
  readonly viewportSize: ProfileImageSize
  readonly zoom: number
}): ProfileImageCropOffset => {
  if (!imageSize) return offset

  const baseScale = getCropBaseScale({ imageSize, viewportSize })
  const renderedWidth = imageSize.width * baseScale * zoom
  const renderedHeight = imageSize.height * baseScale * zoom
  const maxX = Math.max(0, (renderedWidth - viewportSize.width) / 2)
  const maxY = Math.max(0, (renderedHeight - viewportSize.height) / 2)

  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Unable to crop image'))
      },
      type,
      quality,
    )
  })

const getCroppedFileName = (fileName: string) => {
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  return `${baseName || 'image'}-cropped.jpg`
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const cropImageFile = async ({
  file,
  imageSize,
  kind,
  offset,
  zoom,
}: {
  readonly file: File
  readonly imageSize: ProfileImageSize
  readonly kind: ProfileImageKind
  readonly offset: ProfileImageCropOffset
  readonly zoom: number
}) => {
  const bitmap = await createImageBitmap(file)
  const viewportSize = getCropViewportSize(kind)
  const baseScale = getCropBaseScale({ imageSize, viewportSize })
  const scale = baseScale * zoom
  const sourceWidth = viewportSize.width / scale
  const sourceHeight = viewportSize.height / scale
  const sourceX = clamp(
    (bitmap.width - sourceWidth) / 2 - offset.x / scale,
    0,
    Math.max(0, bitmap.width - sourceWidth),
  )
  const sourceY = clamp(
    (bitmap.height - sourceHeight) / 2 - offset.y / scale,
    0,
    Math.max(0, bitmap.height - sourceHeight),
  )
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close()
    throw new Error('Unable to crop image')
  }

  canvas.width = Math.round(viewportSize.width * CROP_OUTPUT_SCALE)
  canvas.height = Math.round(viewportSize.height * CROP_OUTPUT_SCALE)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  bitmap.close()

  const blob = await canvasToBlob(canvas, 'image/jpeg', CROP_JPEG_QUALITY)

  return new File([blob], getCroppedFileName(file.name), {
    type: 'image/jpeg',
  })
}
