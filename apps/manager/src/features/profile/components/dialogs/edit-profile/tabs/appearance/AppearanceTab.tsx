import type { Address } from 'viem'
import { PROFILE_THEMES, type ProfileTheme } from '@/features/profile/constants'
import type { ProfileRecords } from '@/features/profile/types'
import { getProfileTheme } from '@/features/profile/utils/themeColor'
import { cn, truncateAddress } from '@/lib/utils'
import { useEditProfileDialogStatus } from '../../EditProfileDialog.context'

const getPreviewAddress = (values: ProfileRecords, owner?: Address): string => {
  const ethAddress = values.addresses.find(
    (record) => record.coinType === 60,
  )?.value

  return truncateAddress(ethAddress || owner)
}

interface ThemePreviewButtonProps {
  readonly address: string
  readonly disabled?: boolean
  readonly isActive: boolean
  readonly name: string
  readonly onSelect: () => void
  readonly theme: ProfileTheme
}

const ThemePreviewButton = ({
  address,
  disabled,
  isActive,
  name,
  onSelect,
  theme,
}: ThemePreviewButtonProps) => (
  <button
    aria-label={`${theme.label} theme${isActive ? ' (selected)' : ''}`}
    aria-pressed={isActive}
    className={cn(
      'flex shrink-0 cursor-pointer flex-col items-start gap-0.5 overflow-hidden rounded-md p-3 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-ens-lapis-500 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
      isActive && ['ring-2', theme.preview.activeRingClassName],
    )}
    disabled={disabled}
    onClick={onSelect}
    style={{ backgroundImage: theme.preview.backgroundImage }}
    type="button"
  >
    <span
      className={cn(
        'w-fit max-w-full truncate rounded-[0.717px] px-0.75 py-0.5 font-semi-mono text-[14px] leading-ens-none tracking-[-0.28px] md:text-[16px] md:tracking-[-0.32px]',
        theme.preview.badgeClassName,
        theme.preview.badgeTextClassName,
      )}
    >
      {name}
    </span>
    <span
      className={cn(
        'font-mono text-[7px] leading-normal tracking-normal md:text-[9px]',
        theme.preview.addressClassName,
      )}
    >
      {address}
    </span>
  </button>
)

interface AppearanceTabProps {
  readonly name: string
  readonly onBaseChange: (base: ProfileRecords['base']) => void
  readonly owner?: Address
  readonly values: ProfileRecords
}

export const AppearanceTab = ({
  name,
  onBaseChange,
  owner,
  values,
}: AppearanceTabProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const selectedThemeValue = getProfileTheme(values.base.theme).value
  const previewAddress = getPreviewAddress(values, owner)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-bold font-sans text-[#525252] text-base leading-ens-none tracking-[-0.32px]">
          Appearance
        </p>
        <p className="text-base text-ens-quartz-400 leading-ens-normal">
          Choose a theme that fits your style
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROFILE_THEMES.map((theme) => (
          <ThemePreviewButton
            address={previewAddress}
            disabled={isSaving}
            isActive={theme.value === selectedThemeValue}
            key={theme.value}
            name={name}
            onSelect={() =>
              onBaseChange({ ...values.base, theme: theme.value })
            }
            theme={theme}
          />
        ))}
      </div>
    </div>
  )
}
