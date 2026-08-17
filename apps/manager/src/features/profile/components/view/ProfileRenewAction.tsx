import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { LinkButton } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  profileExpiryDateFromSeconds,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import { ThirdPartyRenewalDialog } from '@/features/renew/components/ThirdPartyRenewalDialog'
import { getV1RenewableQueryOptions } from '@/features/renew/data/queries/v1Renewable.query'
import { canRenewV2Name } from '@/features/renew/utils/renewableName'
import {
  getRenewalRoute,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'
import { shouldShowThirdPartyRenewalWarning } from '@/features/renew/utils/thirdPartyRenewalWarning'

type ProfileRenewActionProps = {
  readonly className: string
  readonly isOwner?: boolean
  readonly name: string
  readonly protocol?: RenewalProtocol
}

export const ProfileRenewAction = ({
  className,
  isOwner,
  name,
  protocol,
}: ProfileRenewActionProps) => {
  const { data: expiryData } = useQuery({
    ...profileExpiryQuery(name, protocol),
  })
  const expiryDate = profileExpiryDateFromSeconds(expiryData?.expiry)
  const resolvedProtocol = protocol ?? expiryData?.protocol ?? 'v2'
  const { data: isV1Renewable } = useQuery({
    ...getV1RenewableQueryOptions(name),
    enabled: resolvedProtocol === 'v1',
  })
  const canRenew =
    resolvedProtocol === 'v1'
      ? isV1Renewable === true
      : canRenewV2Name(name, expiryDate)

  if (!canRenew) return null

  const buttonContent = (
    <>
      <Trans>Renew Name</Trans>
      <MSymbol
        aria-hidden="true"
        className="ms-opsz-20 ms-wght-600 text-base leading-none"
        symbol="double_arrow"
      />
    </>
  )

  if (isOwner === undefined) {
    return (
      <button className={className} disabled type="button">
        {buttonContent}
      </button>
    )
  }

  if (shouldShowThirdPartyRenewalWarning(isOwner)) {
    return (
      <ThirdPartyRenewalDialog
        name={name}
        protocol={resolvedProtocol}
        trigger={
          <button className={className} type="button">
            {buttonContent}
          </button>
        }
      />
    )
  }

  return (
    <LinkButton
      className={className}
      params={{ name }}
      to={getRenewalRoute(resolvedProtocol)}
    >
      {buttonContent}
    </LinkButton>
  )
}
