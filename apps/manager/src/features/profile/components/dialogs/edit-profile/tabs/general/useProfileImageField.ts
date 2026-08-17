import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMachine } from '@xstate/react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { imageSelectionMachine } from '@/features/profile/machines/imageSelection'
import { imageRecordQuery } from '@/features/profile/service/profileImageRecord'
import { prepareProfileImageUpload } from '@/features/profile/service/profileImageUpload'
import { profileNftsQuery } from '@/features/profile/service/profileNfts'
import { inspect } from '@/utils/xstate'
import {
  cropImageFile,
  getConstrainedCropOffset,
  getCropViewportSize,
} from './ProfileImageField.crop'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from './ProfileImageField.helpers'
import type {
  ProfileImageCropOffset,
  ProfileImageFieldProps,
  ProfileImageSize,
} from './ProfileImageField.types'

const revokeBlobUrl = (url: string | null) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

export const useProfileImageField = ({
  isActive,
  currentImage,
  disabled,
  kind,
  name,
  onActivate,
  onCancel,
  onImageChange,
  onImageRemove,
  onImageUploadPrepared,
  owner,
  preparedImagePreviewUrl,
}: ProfileImageFieldProps) => {
  const queryClient = useQueryClient()
  const latestCallbacksRef = useRef({
    onCancel,
    onImageChange,
    onImageRemove,
  })
  latestCallbacksRef.current = {
    onCancel,
    onImageChange,
    onImageRemove,
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [cropImageSize, setCropImageSize] = useState<ProfileImageSize | null>(
    null,
  )
  const [cropOffset, setCropOffset] = useState<ProfileImageCropOffset>({
    x: 0,
    y: 0,
  })
  const [cropZoom, setCropZoom] = useState(1)
  const [isCropping, setIsCropping] = useState(false)
  const hasImage = Boolean(currentImage?.trim())
  const imageQuery = useQuery({
    ...imageRecordQuery(currentImage),
    enabled: hasImage && !preparedImagePreviewUrl,
  })
  const displayImage =
    uploadPreviewUrl ||
    preparedImagePreviewUrl ||
    imageQuery.data ||
    currentImage
  const { address } = useAccount()
  const chainId = useChainId()
  const [state, send] = useMachine(imageSelectionMachine, {
    input: {
      onImageChange: (url: string, resolvedImage?: string) => {
        if (resolvedImage) {
          queryClient.setQueryData(
            imageRecordQuery(url).queryKey,
            resolvedImage,
          )
        }
        latestCallbacksRef.current.onImageChange(url)
        latestCallbacksRef.current.onCancel()
      },
      onImageRemove: () => {
        latestCallbacksRef.current.onImageRemove()
        latestCallbacksRef.current.onCancel()
      },
    },
    inspect,
  })
  const isNftSelectionOpen = state.matches('nftSelection')
  const nftOwnerAddress = owner ?? address
  const nftQuery = useQuery({
    ...profileNftsQuery({
      address: nftOwnerAddress,
      chainId,
    }),
    enabled:
      isActive && kind === 'avatar' && isNftSelectionOpen && !!nftOwnerAddress,
  })

  useEffect(() => {
    if (kind !== 'avatar' || !isNftSelectionOpen) return
    send({ type: 'SET_NFTS', nfts: nftQuery.data ?? [] })
  }, [isNftSelectionOpen, kind, nftQuery.data, send])

  const resetEditor = () => {
    send({ type: 'RESET' })
    setUploadFile(null)
    setUploadPreviewUrl(null)
    setCropImageSize(null)
    setCropOffset({ x: 0, y: 0 })
    setCropZoom(1)
    setIsCropping(false)
  }

  const handleCancel = () => {
    resetEditor()
    onCancel()
  }

  useEffect(() => {
    if (!isActive) {
      send({ type: 'RESET' })
      setUploadFile(null)
      setUploadPreviewUrl(null)
      setCropImageSize(null)
      setCropOffset({ x: 0, y: 0 })
      setCropZoom(1)
      setIsCropping(false)
    }
  }, [isActive, send])

  useEffect(() => {
    return () => {
      revokeBlobUrl(uploadPreviewUrl)
    }
  }, [uploadPreviewUrl])

  const processSelectedFile = (file: File) => {
    if (disabled) return

    if (!file.type.startsWith('image/')) {
      send({ type: 'SET_ERROR', error: 'Please select a valid image file' })
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      send({
        type: 'SET_ERROR',
        error: `Image must be under ${MAX_FILE_SIZE_MB}MB`,
      })
      return
    }

    send({ type: 'CLEAR_ERROR' })
    setUploadFile(file)
    setCropImageSize(null)
    setCropOffset({ x: 0, y: 0 })
    setCropZoom(1)
    setUploadPreviewUrl((previousUrl) => {
      revokeBlobUrl(previousUrl)
      return URL.createObjectURL(file)
    })
    onActivate()
    send({ type: 'OPEN_UPLOAD' })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) processSelectedFile(file)
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const file = event.dataTransfer.files[0]
    if (file) processSelectedFile(file)
  }

  const handleUploadClick = () => {
    send({ type: 'CLEAR_ERROR' })
    fileInputRef.current?.click()
  }

  const handleManualClick = () => {
    send({ type: 'CLEAR_ERROR' })
    send({ type: 'OPEN_MANUAL_INPUT' })
  }

  const handleNftClick = () => {
    send({ type: 'CLEAR_ERROR' })
    onActivate()
    send({ type: 'OPEN_NFT_SELECTION' })
  }

  const handleRemoveClick = () => {
    send({ type: 'CLEAR_ERROR' })
    if (hasImage) {
      send({ type: 'OPEN_REMOVE_CONFIRMATION' })
      return
    }
    onImageRemove()
    handleCancel()
  }

  const handleManualPreviewError = () => {
    send({
      type: 'SET_ERROR',
      error:
        'Failed to load image. Please check that the URL points to a valid image file.',
    })
  }

  const constrainCropOffset = (
    offset: ProfileImageCropOffset,
    zoom = cropZoom,
    imageSize = cropImageSize,
  ) =>
    getConstrainedCropOffset({
      imageSize,
      offset,
      viewportSize: getCropViewportSize(kind),
      zoom,
    })

  const handleCropOffsetChange = (offset: ProfileImageCropOffset) => {
    setCropOffset(constrainCropOffset(offset))
  }

  const handleCropZoomChange = (zoom: number) => {
    setCropZoom(zoom)
    setCropOffset((currentOffset) => constrainCropOffset(currentOffset, zoom))
  }

  const handleCropImageLoad = (imageSize: ProfileImageSize) => {
    setCropImageSize(imageSize)
    setCropOffset({ x: 0, y: 0 })
    setCropZoom(1)
  }

  const handleConfirmCrop = async () => {
    if (!uploadFile || !cropImageSize) {
      send({ type: 'SET_ERROR', error: 'No image selected for upload' })
      return
    }

    setIsCropping(true)
    try {
      const croppedFile = await cropImageFile({
        file: uploadFile,
        imageSize: cropImageSize,
        kind,
        offset: cropOffset,
        zoom: cropZoom,
      })
      const upload = await prepareProfileImageUpload({
        chainId,
        file: croppedFile,
        name,
        type: kind,
      })
      setUploadFile(croppedFile)
      setUploadPreviewUrl((previousUrl) => {
        revokeBlobUrl(previousUrl)
        return upload.dataURL
      })
      queryClient.setQueryData(
        imageRecordQuery(upload.imageUrl).queryKey,
        upload.dataURL,
      )
      onImageUploadPrepared?.(upload)
      onImageChange(upload.imageUrl)
      onCancel()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to crop image'
      send({ type: 'SET_ERROR', error: message })
    } finally {
      setIsCropping(false)
    }
  }

  const nftErrorMessage = (() => {
    if (!nftQuery.error) return null
    if (nftQuery.error instanceof Error && nftQuery.error.message) {
      return nftQuery.error.message
    }
    return 'Failed to load NFTs'
  })()

  return {
    cropImageSize,
    cropOffset,
    cropZoom,
    displayImage,
    fileInputRef,
    handleCancel,
    handleConfirmCrop,
    handleCropImageLoad,
    handleCropOffsetChange,
    handleCropZoomChange,
    handleDragOver,
    handleDrop,
    handleFileChange,
    handleManualClick,
    handleManualPreviewError,
    handleNftClick,
    handleRemoveClick,
    handleUploadClick,
    hasImage,
    isCropping,
    isLoadingNfts: nftQuery.isFetching,
    isUploading: false,
    nftErrorMessage,
    nftOwnerAddress,
    send,
    state,
    uploadFile,
    uploadPreviewUrl,
  }
}
