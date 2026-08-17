import { Trans } from '@lingui/react/macro'
import { useFeatureFlagEnabled } from '@posthog/react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { CommemorativeNftProfileSection } from '@/features/migration/components/success/CommemorativeNftProfileSection'
import { isConnectedProfileOwner } from '@/features/profile/components/view/connectedAccounts.helpers'
import {
  buildNameAvatarUrl,
  buildNameHeaderUrl,
} from '@/features/profile/service/profileAvatar'
import {
  getProfileExpiryResultStatus,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import { profileOwnerQuery } from '@/features/profile/service/profileOwner'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { profileRegistrationQuery } from '@/features/profile/service/profileRegistration'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { getDefaultHeaderCover } from '@/features/profile/utils/defaultHeaderCover'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { transformProfileRecords } from '@/features/profile/utils/transformRecords'
import {
  isMigrationNftEnabled,
  POSTHOG_FEATURE_FLAGS,
} from '@/lib/posthog/feature-flags'
import { useSmartAccountContext } from '@/lib/smart-account'
import { ProfileActions, ProfileMobileActions } from './ProfileActions'
import { ProfileBanner } from './ProfileBanner'
import { ProfileCards } from './ProfileCards'
import { ProfileHeader } from './ProfileHeader'
import { ProfileLoading } from './ProfileLoading'
import {
  ProfileGracePeriodBanner,
  ProfileMigrationBanner,
} from './ProfileStatusBanners'
import { ProfileThemeColorProvider } from './ProfileThemeColor'

type ProfileViewProps = {
  readonly name: string
}

type UseIsOwnerParams = {
  readonly owner: Address | undefined
}

const useIsOwner = ({ owner }: UseIsOwnerParams) => {
  const { address } = useConnection()
  const { accountAddress: smartAccountAddress, ownerAddress } =
    useSmartAccountContext()

  return isConnectedProfileOwner({
    owner,
    walletAddress: address,
    accountAddress: smartAccountAddress,
    ownerAddress,
  })
}

const getProfileUrl = (name: string) =>
  `${
    typeof window === 'undefined'
      ? 'https://app.ens.domains'
      : window.location.origin
  }/p/${name}`

const ProfileCommemorativeNftSection = ({
  enabled,
  isOwner,
  name,
}: {
  readonly enabled: boolean
  readonly isOwner: boolean | undefined
  readonly name: string
}) => {
  if (!enabled || !isOwner) return null
  return <CommemorativeNftProfileSection isOwner name={name} />
}

export const ProfileView = ({ name }: ProfileViewProps) => {
  const migrationEnabled = useFeatureFlagEnabled(
    POSTHOG_FEATURE_FLAGS.MIGRATION,
    false,
  )
  const migrationNftEnabled = useFeatureFlagEnabled(
    POSTHOG_FEATURE_FLAGS.MIGRATION_NFT,
    false,
  )
  const commemorativeNftEnabled = isMigrationNftEnabled({
    migrationEnabled,
    migrationNftEnabled,
  })
  const { data: profileRecords, refetch: refetchRecords } = useSuspenseQuery({
    ...profileRecordsQuery(name),
  })
  const records = transformProfileRecords(profileRecords)
  const themeVars = getThemeVars(records.base.theme)

  const { data: ownerData, isPending: isOwnerPending } = useQuery({
    ...profileOwnerQuery(name),
  })
  const {
    data: expiryData,
    isPending: isExpiryPending,
    isError: isExpiryError,
    error: expiryError,
  } = useQuery({
    ...profileExpiryQuery(name, ownerData?.protocol),
  })
  const registration = useQuery({
    ...profileRegistrationQuery(name, ownerData?.protocol),
  })

  const expiry = getProfileExpiryResultStatus(expiryData)
  const owner = ownerData?.owner as Address | undefined
  const ownerReverseName = useQuery({
    ...profileReverseNameQuery(owner),
  })
  const isOwner = useIsOwner({ owner })
  const ownerMissing = !isOwnerPending && !ownerData?.owner

  if (ownerMissing && isExpiryPending) {
    return <ProfileLoading name={name} />
  }

  if (ownerMissing && isExpiryError) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        <p className="text-foreground text-sm">
          <Trans>Failed to load registration data for this name.</Trans>
        </p>
        {expiryError?.message ? (
          <p className="text-muted-foreground text-xs">{expiryError.message}</p>
        ) : null}
      </div>
    )
  }

  const avatarUrl = expiry.isInGrace ? undefined : buildNameAvatarUrl(name)
  const headerUrl =
    expiry.isInGrace || !records.base.header?.trim()
      ? undefined
      : buildNameHeaderUrl(name)
  const defaultHeaderUrl = getDefaultHeaderCover({
    isInGrace: expiry.isInGrace,
    themeColor: records.base.theme,
  })
  const profileThemeColor = expiry.isInGrace
    ? undefined
    : themeVars['--theme-color']
  const hasMobileStatusBanner = migrationEnabled || expiry.isInGrace
  const resolvedIsOwner = isOwnerPending ? undefined : isOwner

  return (
    <div
      className="relative -mt-13.5 min-h-screen bg-[#FCFBFB] pb-[calc(117px+env(safe-area-inset-bottom,0))] lg:landscape:-mt-20 lg:landscape:pb-28.5"
      style={expiry.isInGrace ? undefined : (themeVars as React.CSSProperties)}
    >
      <ProfileThemeColorProvider value={profileThemeColor}>
        <ProfileBanner
          defaultHeaderUrl={defaultHeaderUrl}
          headerLoading={false}
          headerUrl={headerUrl}
          name={name}
        />
        <ProfileMigrationBanner
          className="absolute inset-x-4 top-32 z-20 mx-auto hidden max-w-275.5 lg:landscape:block"
          isMigrationEnabled={migrationEnabled}
          name={name}
        />
        <ProfileGracePeriodBanner
          className="absolute inset-x-4 top-24.5 z-20 mx-auto hidden max-w-275.5 lg:landscape:block"
          expiry={expiry}
          isOwner={resolvedIsOwner}
          name={name}
          protocol={ownerData?.protocol}
        />
        <div className="relative z-10 mx-auto -mt-21 w-full max-w-97.5 space-y-0 lg:landscape:-mt-11.25 lg:landscape:max-w-226.25">
          <div>
            <ProfileMigrationBanner
              className="mb-6 lg:landscape:hidden"
              isMigrationEnabled={migrationEnabled}
              name={name}
            />
            <ProfileGracePeriodBanner
              className="mb-6 lg:landscape:hidden"
              expiry={expiry}
              isOwner={resolvedIsOwner}
              name={name}
              protocol={ownerData?.protocol}
            />
            <ProfileHeader
              avatarLoading={false}
              avatarUrl={avatarUrl}
              displayExpiryDate={expiry.displayExpiryDate}
              hasMobileStatusBanner={hasMobileStatusBanner}
              mobileActions={
                <ProfileMobileActions
                  avatarUrl={avatarUrl}
                  isOwner={resolvedIsOwner}
                  name={name}
                  renewalProtocol={ownerData?.protocol}
                  url={getProfileUrl(name)}
                />
              }
              name={name}
              owner={owner}
              ownerReverseName={ownerReverseName.data}
              records={records}
              registrationDate={registration.data?.registrationDate}
            />
            <div className="space-y-0">
              <ProfileCards
                avatarUrl={avatarUrl}
                name={name}
                records={records}
              />
              <ProfileCommemorativeNftSection
                enabled={commemorativeNftEnabled}
                isOwner={resolvedIsOwner}
                name={name}
              />
            </div>
          </div>
        </div>
        <ProfileActions
          avatarUrl={avatarUrl}
          hasMobileStatusBanner={hasMobileStatusBanner}
          isInGrace={expiry.isInGrace}
          isOwner={resolvedIsOwner}
          name={name}
          onUpdated={refetchRecords}
          owner={owner}
          records={records}
          renewalProtocol={ownerData?.protocol}
          url={getProfileUrl(name)}
        />
      </ProfileThemeColorProvider>
    </div>
  )
}
