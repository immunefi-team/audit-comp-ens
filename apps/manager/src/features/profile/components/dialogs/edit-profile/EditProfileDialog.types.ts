import type { Address } from 'viem'
import type { PreparedProfileImageUpload } from '@/features/profile/service/profileImageUpload'
import type { ProfileRecords } from '@/features/profile/types'

export interface EditProfileForm {
  readonly reset: (records: ProfileRecords) => void
}

export interface EditProfileDialogProps {
  readonly name: string
  readonly records: ProfileRecords
  readonly owner?: Address
  readonly onUpdated?: () => undefined | Promise<unknown>
  readonly trigger?: React.ReactNode
}

interface EditProfileSaveOptions {
  readonly hasRecordChanges: boolean
  readonly preparedImageUploads: readonly PreparedProfileImageUpload[]
}

export type EditProfileSaveHandler = (
  currentRecords: ProfileRecords,
  options: EditProfileSaveOptions,
) => void
