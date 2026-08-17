import { cn } from '@/lib/utils'
import type { ProfileImageKind } from './ProfileImageField.types'

export const MAX_FILE_SIZE_MB = 3
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export const fieldShellClassName =
  'rounded-sm border border-ens-quartz-250 bg-white'

export const focusVisibleRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ens-lapis-500 focus-visible:ring-offset-2'

export const dropZoneClassName = cn(
  fieldShellClassName,
  'border-dashed bg-ens-quartz-50',
)

export const getEmptyLabel = (kind: ProfileImageKind) =>
  kind === 'avatar' ? 'Add a profile picture' : 'Add a banner image'

export const getChangeLabel = (kind: ProfileImageKind) =>
  kind === 'avatar' ? 'Change profile picture' : 'Change banner image'

export const getTitle = (kind: ProfileImageKind) =>
  kind === 'avatar' ? 'profile picture' : 'banner image'
