import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { DialogClose, DialogTitle } from '@/components/ui/dialog'
import { imageRecordQuery } from '@/features/profile/service/profileImageRecord'
import { useEditProfileDialogStatus } from './EditProfileDialog.context'
import { getEditProfileDialogHeaderStyle } from './EditProfileDialogHeaderTheme'

interface EditProfileDialogHeaderProps {
  readonly avatarPreviewUrl?: string
  readonly avatarUrl?: string
  readonly canSave: boolean
  readonly name: string
  readonly onSave: () => void
  readonly themeColor?: string | null
}

export const EditProfileDialogHeader = ({
  avatarPreviewUrl,
  avatarUrl,
  canSave,
  name,
  onSave,
  themeColor,
}: EditProfileDialogHeaderProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const resolvedAvatar = useQuery({
    ...imageRecordQuery(avatarUrl),
    enabled: !!avatarUrl && !avatarPreviewUrl,
  })
  const displayAvatarUrl = avatarPreviewUrl ?? resolvedAvatar.data ?? avatarUrl
  const themeVars = getEditProfileDialogHeaderStyle(themeColor)

  return (
    <div
      className="flex shrink-0 items-center justify-between px-4 pt-6 pb-1 md:p-6"
      style={themeVars}
    >
      <div className="flex min-w-0 items-center gap-1">
        <div className="size-9.75 shrink-0 overflow-hidden rounded-sm">
          <ImageFallback.Root className="contents">
            {displayAvatarUrl ? (
              <ImageFallback.Image
                alt={`${name} avatar`}
                className="h-full w-full object-cover"
                src={displayAvatarUrl}
              />
            ) : null}
            <ImageFallback.Fallback>
              <PatternAvatar
                className="border-none p-0 shadow-none"
                color={themeVars['--theme-color']}
                name={name}
              />
            </ImageFallback.Fallback>
          </ImageFallback.Root>
        </div>
        <DialogTitle className="flex h-9.75 max-w-[calc(100vw-7rem)] items-center truncate rounded-sm border border-(--theme-color) px-2 font-medium font-semi-mono text-(--theme-color) text-[21.25px] leading-[0.96] tracking-[-0.425px] md:max-w-104 md:text-[28px] md:tracking-[-0.595px]">
          {name}
        </DialogTitle>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <DialogClose asChild>
          <button
            className="rounded-sm px-[15.419px] py-3 font-medium font-mono text-[#404040] text-xs uppercase leading-normal tracking-[0.96px] transition-colors hover:bg-ens-quartz-50 disabled:pointer-events-none disabled:opacity-50"
            disabled={isSaving}
            type="button"
          >
            <Trans>Cancel</Trans>
          </button>
        </DialogClose>
        <button
          className="flex items-center gap-3 rounded-sm bg-ens-lapis-500 px-[15.419px] py-3 font-medium font-mono text-white text-xs uppercase leading-normal tracking-[0.96px] transition-colors hover:bg-ens-lapis-core disabled:pointer-events-none disabled:opacity-50"
          disabled={!canSave || isSaving}
          onClick={onSave}
          type="button"
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {isSaving ? <Trans>Saving</Trans> : <Trans>Save Profile</Trans>}
        </button>
      </div>
    </div>
  )
}
