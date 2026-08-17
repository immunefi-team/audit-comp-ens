import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Copy } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Address } from 'viem'
import type { ProfileAddressName } from '@/features/profile/service/profileAddressNames'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import {
  getProfileExpiryResultStatus,
  getProfileNameExpiryStatus,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import { profileOwnerQuery } from '@/features/profile/service/profileOwner'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { profileRegistrationQuery } from '@/features/profile/service/profileRegistration'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { transformProfileRecords } from '@/features/profile/utils/transformRecords'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import { truncateAddress } from '@/lib/utils'
import { findPrimaryAddressName } from './addressProfilePrimary'
import { ProfileAbout } from './ProfileAbout'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileDetails } from './ProfileDetails'
import { ProfileThemeColorProvider } from './ProfileThemeColor'

const AddressBadge = ({ address }: { readonly address: Address }) => {
  const { t } = useLingui()
  const { copied, copy } = useCopyFeedback()

  return (
    <div className="inline-flex h-13.5 max-w-full items-center rounded border border-ens-quartz-700">
      <div className="flex h-12 items-center px-3 py-2">
        <span
          className="truncate font-semi-mono text-[28px] text-ens-quartz-900 leading-[0.96] tracking-[-0.56px] md:text-[32px] md:tracking-[-0.64px]" // Figma-spec type size/tracking — no matching design tokens
        >
          {truncateAddress(address)}
        </span>
        <button
          aria-label={t`Copy to clipboard`}
          className="ml-1 inline-flex size-6 shrink-0 items-center justify-center text-ens-quartz-400"
          onClick={() => copy(address)}
          title={t`Copy to clipboard`}
          type="button"
        >
          {copied ? (
            <Check className="size-5" />
          ) : (
            <Copy className="size-5" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  )
}

const useAddressProfileHeaderData = ({
  address,
  addressNames,
  primaryName,
  isNamesPending,
}: {
  readonly address: Address
  readonly addressNames: readonly ProfileAddressName[]
  readonly primaryName?: string
  readonly isNamesPending: boolean
}) => {
  const primaryEntry = findPrimaryAddressName(addressNames, primaryName)
  const isV1Primary = primaryEntry?.protocol === 'v1'
  const useChainMetadata = !!primaryName && !isNamesPending && !isV1Primary

  const { data: ownerData } = useQuery({
    ...profileOwnerQuery(primaryName ?? ''),
    enabled: useChainMetadata,
  })
  const owner = isV1Primary
    ? address
    : (ownerData?.owner as Address | undefined)
  const { data: registration } = useQuery({
    ...profileRegistrationQuery(primaryName ?? '', ownerData?.protocol),
    enabled: useChainMetadata,
  })
  const { data: expiryData } = useQuery({
    ...profileExpiryQuery(primaryName ?? '', ownerData?.protocol),
    enabled: useChainMetadata,
  })
  const { data: profileRecords } = useQuery({
    ...profileRecordsQuery(primaryName ?? ''),
    enabled: useChainMetadata,
  })

  const expiry =
    isV1Primary && primaryEntry
      ? getProfileNameExpiryStatus(primaryEntry.expiryDate, 'v1')
      : getProfileExpiryResultStatus(expiryData)
  const registrationDate = isV1Primary
    ? primaryEntry?.createdAt
    : registration?.registrationDate
  const records = profileRecords
    ? transformProfileRecords(profileRecords)
    : null
  const themeVars = records ? getThemeVars(records.base.theme) : undefined
  const themeColor = themeVars?.['--theme-color']
  const avatarUrl =
    primaryName && !expiry.isInGrace
      ? buildNameAvatarUrl(primaryName)
      : undefined

  return {
    isV1Primary,
    owner,
    expiry,
    registrationDate,
    records,
    themeVars,
    themeColor,
    avatarUrl,
  }
}

/**
 * Owns the reverse-name query, which depends on the owner resolved by the
 * parent's owner query — split into its own component to avoid a query
 * waterfall inside a single hook.
 */
const AddressProfileDetailsSection = ({
  primaryName,
  isV1Primary,
  owner,
  displayExpiryDate,
  registrationDate,
}: {
  readonly primaryName: string
  readonly isV1Primary: boolean
  readonly owner?: Address
  readonly displayExpiryDate?: Date | null
  readonly registrationDate?: number | null
}) => {
  const { data: ownerReverseName } = useQuery({
    ...profileReverseNameQuery(owner),
    enabled: !isV1Primary && !!owner,
  })

  return (
    <ProfileDetails
      displayExpiryDate={displayExpiryDate}
      owner={owner}
      ownerReverseName={isV1Primary ? primaryName : ownerReverseName}
      registrationDate={registrationDate}
    />
  )
}

const AddressProfileAvatarSection = ({
  primaryName,
  isV1Primary,
  avatarUrl,
  records,
  themeColor,
}: {
  readonly primaryName: string
  readonly isV1Primary: boolean
  readonly avatarUrl?: string
  readonly records: ReturnType<typeof transformProfileRecords> | null
  readonly themeColor?: string
}) => {
  if (records) {
    return (
      <ProfileThemeColorProvider value={themeColor}>
        <div className="flex flex-col gap-6 lg:landscape:flex-row lg:landscape:items-stretch">
          <ProfileAvatar
            avatarLoading={false}
            avatarUrl={avatarUrl}
            className="mx-auto size-38 rounded-xl shadow-none lg:landscape:mx-0 lg:landscape:size-[147px]" // 147px avatar per Figma — not on the spacing scale
            name={primaryName}
          />
          <ProfileAbout records={records} />
        </div>
      </ProfileThemeColorProvider>
    )
  }

  if (isV1Primary && avatarUrl) {
    return (
      <ProfileAvatar
        avatarLoading={false}
        avatarUrl={avatarUrl}
        className="mx-auto size-38 rounded-xl shadow-none"
        name={primaryName}
      />
    )
  }

  return null
}

export const AddressProfileHeader = ({
  address,
  addressNames,
  primaryName,
  isNamesPending = false,
}: {
  readonly address: Address
  readonly addressNames: readonly ProfileAddressName[]
  readonly primaryName?: string
  readonly isNamesPending?: boolean
}) => {
  const {
    isV1Primary,
    owner,
    expiry,
    registrationDate,
    records,
    themeVars,
    themeColor,
    avatarUrl,
  } = useAddressProfileHeaderData({
    address,
    addressNames,
    primaryName,
    isNamesPending,
  })

  return (
    <div
      className="w-full space-y-[21.7px]" // 21.7px section gap per Figma — not on the spacing scale
      style={themeVars as CSSProperties | undefined}
    >
      <div className="space-y-3.25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AddressBadge address={address} />
          {primaryName ? (
            <Link
              className="inline-flex h-13.5 w-full items-center justify-center rounded border border-ens-quartz-900 px-4 font-medium font-mono text-ens-quartz-700 text-sm uppercase tracking-[1.12px] hover:bg-ens-quartz-50 sm:w-[185px]" // Figma-spec tracking and fixed button width — no matching tokens
              params={{ name: primaryName }}
              to="/$name"
            >
              <Trans>View profile</Trans>
            </Link>
          ) : null}
        </div>

        {primaryName ? (
          <AddressProfileDetailsSection
            displayExpiryDate={expiry.displayExpiryDate}
            isV1Primary={isV1Primary}
            owner={owner}
            primaryName={primaryName}
            registrationDate={registrationDate}
          />
        ) : null}
      </div>

      {primaryName ? (
        <AddressProfileAvatarSection
          avatarUrl={avatarUrl}
          isV1Primary={isV1Primary}
          primaryName={primaryName}
          records={records}
          themeColor={themeColor}
        />
      ) : null}
    </div>
  )
}
