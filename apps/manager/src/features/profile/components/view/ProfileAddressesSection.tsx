import { Trans } from '@lingui/react/macro'
import { CopyableButton } from '@/components/atoms/CopyableButton'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { IconRenderer } from '@/features/profile/components/IconRenderer'
import type { ProfileRecords } from '@/features/profile/types'
import { cn, truncateAddress } from '@/lib/utils'
import {
  cardSurfaceClassName,
  ProfileCard,
  profileCardCopyIconClassName,
  profileCardTrailingIconStrokeWidth,
} from './ProfileCard'
import { useProfileThemeColor } from './ProfileThemeColor'
import {
  formatChainSpecificAddress,
  getChainSpecificAddresses,
  getMainReceivingAddress,
  getReceivingAddressChains,
  type ProfileAddressItem,
} from './ProfileView.helpers'

type ProfileAddressesSectionProps = {
  readonly avatarUrl?: string
  readonly name: string
  readonly records: ProfileRecords
}

const addressCardPaddingClassName =
  'has-[>svg]:px-4 lg:landscape:p-[24.25px] lg:landscape:has-[>svg]:px-[24.25px]'

const AddressValue = ({
  className = '',
  value,
}: {
  readonly className?: string
  readonly value: string
}) => (
  <span
    className={`truncate font-mono text-[12px] tracking-[0.84px] lg:landscape:text-[13px] lg:landscape:tracking-[0.91px] ${className}`}
  >
    {truncateAddress(value)}
  </span>
)

const ChainAddressValue = ({ value }: { readonly value: string }) => (
  <span
    className="w-19.75 whitespace-nowrap text-[13px] text-ens-quartz-400 leading-[1.2] tracking-[-0.26px] lg:landscape:w-21.25 lg:landscape:text-sm lg:landscape:leading-[1.1] lg:landscape:tracking-[-0.28px]"
    title={value}
  >
    {formatChainSpecificAddress(value)}
  </span>
)

const ReceivingChainIcons = ({
  chains,
}: {
  readonly chains: ProfileAddressItem[]
}) => {
  const withIcon = chains.filter((chain) => chain.icon)
  if (withIcon.length === 0) return null

  return (
    <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1 lg:landscape:min-w-50">
      {withIcon.map((chain) => (
        <IconRenderer
          className="size-4.5 object-contain lg:landscape:size-6.5"
          icon={chain.icon}
          key={`${chain.coinType}-${chain.value}`}
        />
      ))}
    </div>
  )
}

const MainAddressCard = ({
  address,
  avatarUrl,
  chains,
  name,
}: {
  readonly address: ProfileAddressItem
  readonly avatarUrl?: string
  readonly chains: ProfileAddressItem[]
  readonly name: string
}) => {
  const themeColor = useProfileThemeColor()

  return (
    <CopyableButton
      className={`${cardSurfaceClassName} ${addressCardPaddingClassName} h-auto min-h-13.75 w-full justify-between gap-2 py-4 lg:landscape:max-w-132.75`}
      iconClassName={profileCardCopyIconClassName}
      iconStrokeWidth={profileCardTrailingIconStrokeWidth}
      value={address.value}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 lg:landscape:h-6.5 lg:landscape:gap-4">
          <div className="flex min-w-0 items-center gap-1">
            <div className="size-5.5 shrink-0 overflow-hidden rounded-full bg-ens-quartz-100 lg:landscape:size-[25.576px] lg:landscape:rounded-sm">
              <ImageFallback.Root className="contents">
                <ImageFallback.Image
                  alt={`${name} avatar`}
                  className="size-full object-cover"
                  src={avatarUrl}
                />
                <ImageFallback.Fallback>
                  <PatternAvatar
                    className="size-full rounded-sm border-none bg-transparent p-0 shadow-none"
                    color={themeColor}
                    name={name}
                  />
                </ImageFallback.Fallback>
              </ImageFallback.Root>
            </div>
            <span className="truncate font-semi-mono text-[13px] text-ens-quartz-900 lg:landscape:text-sm lg:landscape:leading-[0.96] lg:landscape:tracking-[-0.28px]">
              {name}
            </span>
          </div>
          <AddressValue className="text-ens-quartz-900" value={address.value} />
        </div>
        <ReceivingChainIcons chains={chains} />
      </div>
    </CopyableButton>
  )
}

const ChainAddressCard = ({
  address,
}: {
  readonly address: ProfileAddressItem
}) => (
  <CopyableButton
    className={cn(
      cardSurfaceClassName,
      addressCardPaddingClassName,
      'h-16.25 w-full justify-between gap-1 px-3 py-0 has-[>svg]:px-3 lg:landscape:h-auto lg:landscape:min-h-[88.5px] lg:landscape:gap-2 lg:landscape:px-[24.25px] lg:landscape:has-[>svg]:px-[24.25px]',
    )}
    iconClassName={profileCardCopyIconClassName}
    iconStrokeWidth={profileCardTrailingIconStrokeWidth}
    value={address.value}
  >
    <div className="flex min-w-0 items-center gap-1 lg:landscape:gap-0">
      <div className="flex size-7 shrink-0 items-center justify-center lg:landscape:size-10 lg:landscape:p-2">
        <IconRenderer
          className="size-6 object-contain lg:landscape:size-7"
          icon={address.icon}
        />
      </div>
      <ChainAddressValue value={address.value} />
    </div>
  </CopyableButton>
)

export const ProfileAddressesSection = ({
  avatarUrl,
  name,
  records,
}: ProfileAddressesSectionProps) => {
  const mainAddress = getMainReceivingAddress(records)
  const receivingChains = getReceivingAddressChains(records)
  const chainAddresses = getChainSpecificAddresses(records)

  if (!mainAddress && chainAddresses.length === 0) return null

  return (
    <ProfileCard title={<Trans>Addresses</Trans>}>
      <div className="space-y-6">
        {mainAddress ? (
          <div>
            <h3 className="mb-3 text-ens-quartz-600 text-sm leading-normal">
              <Trans>Main receiving address</Trans>
            </h3>
            <MainAddressCard
              address={mainAddress}
              avatarUrl={avatarUrl}
              chains={receivingChains}
              name={name}
            />
          </div>
        ) : null}
        {chainAddresses.length > 0 ? (
          <div>
            <h3 className="mb-3 text-ens-quartz-600 text-sm leading-normal">
              <Trans>Chain-specific addresses</Trans>
            </h3>
            <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 lg:landscape:grid-cols-3 lg:landscape:gap-6">
              {chainAddresses.map((address) => (
                <ChainAddressCard
                  address={address}
                  key={`${address.coinType}-${address.value}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ProfileCard>
  )
}
