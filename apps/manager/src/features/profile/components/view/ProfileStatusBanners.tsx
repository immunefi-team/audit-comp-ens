import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { GracePeriodBanner } from '@/features/grace/components/GracePeriodBanner'
import { UpgradeBanner } from '@/features/migration/components/UpgradeBanner'
import type { getProfileNameExpiryStatus } from '@/features/profile/service/profileExpiry'
import { getV1RenewableQueryOptions } from '@/features/renew/data/queries/v1Renewable.query'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'

type ProfileGracePeriodBannerProps = {
  readonly className?: string
  readonly expiry: ReturnType<typeof getProfileNameExpiryStatus>
  readonly isOwner?: boolean
  readonly name: string
  readonly protocol?: RenewalProtocol
}

export const ProfileGracePeriodBanner = ({
  className,
  expiry,
  isOwner,
  name,
  protocol,
}: ProfileGracePeriodBannerProps) => {
  const { data: isV1Renewable } = useQuery({
    ...getV1RenewableQueryOptions(name),
    enabled: protocol === 'v1',
  })

  if (protocol === 'v1' && isV1Renewable !== true) return null

  return match({ expiry, isOwner })
    .with(
      {
        expiry: { isInGrace: true, graceEndDate: P.not(P.nullish) },
        isOwner: P.boolean,
      },
      ({ expiry: { graceEndDate }, isOwner }) => (
        <div className={className}>
          <GracePeriodBanner
            graceEndDate={graceEndDate}
            renewName={name}
            renewProtocol={protocol ?? 'v2'}
            variant={isOwner ? 'profileOwnName' : 'profileNotOwnedName'}
          />
        </div>
      ),
    )
    .otherwise(() => null)
}

type ProfileMigrationBannerProps = {
  readonly className?: string
  readonly isMigrationEnabled: boolean
  readonly name: string
}

export const ProfileMigrationBanner = ({
  className,
  isMigrationEnabled,
  name,
}: ProfileMigrationBannerProps) =>
  isMigrationEnabled ? (
    <UpgradeBanner className={className} profileName={name} />
  ) : null
