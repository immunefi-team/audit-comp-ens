import type { SignTypedDataMutateAsync } from '@wagmi/core/query'
import { sha256 } from 'viem'
import { AVATAR_UPLOAD_BASE_URL } from '@/features/profile/constants'

const UPLOAD_TIMEOUT_MS = 30000
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7
const JPEG_QUALITY = 0.9

export type ImageType = 'avatar' | 'header'

export interface PreparedProfileImageUpload {
  readonly dataURL: string
  readonly hash: string
  readonly imageUrl: string
  readonly kind: ImageType
  readonly name: string
}

const fileToDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })

const dataURLToImage = (dataURL: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = (err) => reject(err)
    image.src = dataURL
  })

const fileToJpegDataURL = async (file: File) => {
  if (file.type === 'image/jpeg') return fileToDataURL(file)

  const dataURL = await fileToDataURL(file)
  const image = await dataURLToImage(dataURL)
  const canvas = document.createElement('canvas')
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')

  if (!context || !width || !height) {
    throw new Error('Unable to process image for upload')
  }

  canvas.width = width
  canvas.height = height

  // JPEG has no alpha channel, so paint a white background first.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

const dataURLToBytes = (dataURL: string) => {
  const [, base64 = ''] = dataURL.split(',')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return bytes
}

interface UploadRequestParams {
  readonly address: string
  readonly dataURL: string
  readonly endpoint: string
  readonly expiry: string
  readonly sig: string
}

const getChainName = (chainId: number | null | undefined) => {
  if (!chainId || chainId === 1) return 'mainnet'
  // Default to sepolia for non-mainnet in this app
  return 'sepolia'
}

const getUploadEndpoint = ({
  chainId,
  name,
  type,
}: {
  readonly chainId: number | undefined
  readonly name: string
  readonly type: ImageType
}) => {
  const chainName = getChainName(chainId)
  const baseUrlRoot = AVATAR_UPLOAD_BASE_URL

  if (type === 'avatar') {
    const baseURL =
      chainName === 'mainnet' ? baseUrlRoot : `${baseUrlRoot}/${chainName}`
    return `${baseURL}/${name}`
  }

  return chainName === 'mainnet'
    ? `${baseUrlRoot}/${name}/h`
    : `${baseUrlRoot}/${chainName}/${name}/h`
}

const getUploadHash = (dataURL: string) => {
  const hash = sha256(dataURLToBytes(dataURL), 'hex')
  return hash.startsWith('0x') ? hash.slice(2) : hash
}

const signImageUpload = ({
  expiry,
  hash,
  name,
  signTypedDataAsync,
  type,
}: {
  readonly expiry: string
  readonly hash: string
  readonly name: string
  readonly signTypedDataAsync: SignTypedDataMutateAsync<unknown>
  readonly type: ImageType
}) =>
  signTypedDataAsync({
    primaryType: 'Upload',
    domain: {
      name: 'Ethereum Name Service',
      version: '1',
    },
    types: {
      Upload: [
        { name: 'upload', type: 'string' },
        { name: 'expiry', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'hash', type: 'string' },
      ],
    },
    message: {
      upload: type,
      expiry,
      name,
      hash,
    },
  })

const uploadSignedImage = async ({
  address,
  dataURL,
  endpoint,
  expiry,
  sig,
}: UploadRequestParams) => {
  const response = await fetch(endpoint, {
    method: 'PUT',
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiry,
      dataURL,
      sig,
      unverifiedAddress: address,
    }),
  })

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`)
  }

  const result = (await response.json()) as
    | { message: string }
    | { error: string; status?: number }

  if ('message' in result && result.message === 'uploaded') {
    return
  }

  if ('error' in result) {
    throw new Error(result.error)
  }

  throw new Error('Unknown error')
}

export const prepareProfileImageUpload = async ({
  type,
  name,
  chainId,
  file,
}: {
  readonly type: ImageType
  readonly name: string
  readonly chainId: number | undefined
  readonly file: File
}): Promise<PreparedProfileImageUpload> => {
  const dataURL = await fileToJpegDataURL(file)
  const imageUrl = getUploadEndpoint({ chainId, name, type })

  return {
    dataURL,
    hash: getUploadHash(dataURL),
    imageUrl,
    kind: type,
    name,
  }
}

export const submitPreparedProfileImageUpload = async ({
  upload,
  address,
  signTypedDataAsync,
}: {
  readonly upload: PreparedProfileImageUpload
  readonly address: string
  readonly signTypedDataAsync: SignTypedDataMutateAsync<unknown>
}) => {
  const expiry = `${Date.now() + ONE_WEEK_MS}`
  const sig = await signImageUpload({
    expiry,
    hash: upload.hash,
    name: upload.name,
    signTypedDataAsync,
    type: upload.kind,
  })

  try {
    await uploadSignedImage({
      address,
      dataURL: upload.dataURL,
      endpoint: upload.imageUrl,
      expiry,
      sig,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload timed out. Please try again.')
    }
    throw err
  }
}
