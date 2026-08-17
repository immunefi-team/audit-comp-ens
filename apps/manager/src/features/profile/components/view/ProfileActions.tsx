import { useLingui } from '@lingui/react/macro'
import type { Address } from 'viem'
import { normalizeEthName } from '@/features/profile/service/profileName'
import type { ProfileRecords } from '@/features/profile/types'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'
import {
  desktopActionContainerClassName,
  desktopActionContainerStyle,
  editActionClassName,
  editBottomNavClassName,
  editBottomNavContentClassName,
  renewActionClassName,
} from './ProfileAction.styles'
import { ProfileEditAction } from './ProfileEditAction'
import { ProfileFavoriteAction } from './ProfileFavoriteAction'
import { ProfileRenewAction } from './ProfileRenewAction'
import { ProfileShareAction } from './ProfileShareAction'

type ProfileActionsProps = {
  readonly avatarUrl?: string
  readonly hasMobileStatusBanner: boolean
  readonly isInGrace: boolean
  readonly isOwner?: boolean
  readonly name: string
  readonly onUpdated: () => undefined | Promise<unknown>
  readonly owner?: Address
  readonly records: ProfileRecords
  readonly renewalProtocol?: RenewalProtocol
  readonly url: string
}

type ProfileMobileActionsProps = Pick<
  ProfileActionsProps,
  'avatarUrl' | 'isOwner' | 'name' | 'renewalProtocol' | 'url'
>

export const ProfileMobileActions = ({
  avatarUrl,
  isOwner,
  name,
  renewalProtocol,
  url,
}: ProfileMobileActionsProps) => (
  <div className="flex w-full items-center justify-between lg:landscape:hidden">
    <ProfileRenewAction
      className={renewActionClassName}
      isOwner={isOwner}
      name={name}
      protocol={renewalProtocol}
    />
    <div className="flex shrink-0 items-center gap-4">
      <ProfileFavoriteAction name={name} />
      <ProfileShareAction avatarUrl={avatarUrl} name={name} url={url} />
    </div>
  </div>
)

export const ProfileActions = ({
  avatarUrl,
  hasMobileStatusBanner,
  isInGrace,
  isOwner,
  name,
  onUpdated,
  owner,
  records,
  renewalProtocol,
  url,
}: ProfileActionsProps) => {
  const { t } = useLingui()
  // Imported DNS names are served by the v1 registry too, but stay editable.
  const isUnmigratedEthName =
    renewalProtocol === 'v1' && normalizeEthName(name) !== null

  return (
    <>
      {hasMobileStatusBanner ? null : (
        <div className="absolute inset-x-0 top-118.5 z-30 lg:landscape:hidden">
          <div className="mx-auto w-full max-w-97.5 px-5">
            <ProfileMobileActions
              avatarUrl={avatarUrl}
              isOwner={isOwner}
              name={name}
              renewalProtocol={renewalProtocol}
              url={url}
            />
          </div>
        </div>
      )}

      <div
        className={desktopActionContainerClassName}
        style={desktopActionContainerStyle}
      >
        <div className="flex items-center gap-6">
          <ProfileFavoriteAction name={name} />
          <ProfileShareAction avatarUrl={avatarUrl} name={name} url={url} />
        </div>
        <ProfileRenewAction
          className={renewActionClassName}
          isOwner={isOwner}
          name={name}
          protocol={renewalProtocol}
        />
      </div>

      {isOwner && !isInGrace && !isUnmigratedEthName ? (
        <nav aria-label={t`Profile actions`} className={editBottomNavClassName}>
          <div className={editBottomNavContentClassName}>
            <ProfileEditAction
              className={editActionClassName}
              isInGrace={isInGrace}
              isOwner={isOwner}
              name={name}
              onUpdated={onUpdated}
              owner={owner}
              protocol={renewalProtocol}
              records={records}
            />
          </div>
        </nav>
      ) : null}
    </>
  )
}
