import type { Address } from 'viem'
import type {
  ImageType,
  PreparedProfileImageUpload,
} from '@/features/profile/service/profileImageUpload'

export type ProfileImageKind = ImageType

export interface ProfileImageFieldProps {
  readonly isActive: boolean
  readonly currentImage?: string
  readonly disabled?: boolean
  readonly kind: ProfileImageKind
  readonly name: string
  readonly onActivate: () => void
  readonly onCancel: () => void
  readonly onImageChange: (imageUrl: string) => void
  readonly onImageRemove: () => void
  readonly onImageUploadPrepared?: (upload: PreparedProfileImageUpload) => void
  readonly owner?: Address
  readonly preparedImagePreviewUrl?: string
  readonly themeColor?: string | null
}

export interface ProfileImageSize {
  readonly height: number
  readonly width: number
}

export interface ProfileImageCropOffset {
  readonly x: number
  readonly y: number
}
