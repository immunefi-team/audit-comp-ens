import { useQuery } from '@tanstack/react-query'
import { getV1ExpiryQueryOptions } from '@/features/profile/hooks/useV1Expiry'
import { getV2RegistrationDataQueryOptions } from '@/features/profile/hooks/useV2RegistrationData'
import type { ProtocolVersion } from '@/utils/types'
import { isExtendable2LD } from '../utils/nameExtension'
import { useV1Renewable } from './useIsRenewable'
import type { SelectedName } from './useRenewalTransactions'

type UseCanExtendParameters = {
  name: string
  protocolVersion: ProtocolVersion
  enabled?: boolean
}

type UseCanExtendReturnType = {
  canExtend: boolean
  selectedName: SelectedName
  expiryDate: Date | undefined
  /** True while the v1 on-chain renewability check is still resolving. */
  isLoading: boolean
}

/**
 * "Can this name be renewed right now?" — combines the client-side
 * `isExtendable2LD` window check with the renewer's authoritative on-chain
 * `isRenewable` (via the shared {@link useV1Renewable}).
 *
 * For v1 names the on-chain check is decisive: `ETHRenewerV1` renews a name only
 * if it is premigration-RESERVED or within the renewer's own grace definition, so
 * an unreserved v1 name can be non-renewable even though the coarse client-side
 * window (`isExtendable2LD`) still passes — the banner must not promise an
 * extension the renewer would revert. v2 relies solely on the client-side window
 * (the v2 registrar renews throughout registered + grace).
 */
export const useCanExtend = ({
  name,
  protocolVersion,
  enabled = true,
}: UseCanExtendParameters): UseCanExtendReturnType => {
  const isV2 = protocolVersion === 'ENSv2'

  const v1ExpiryQuery = useQuery({
    ...getV1ExpiryQueryOptions({ name }),
    enabled: enabled && !isV2,
  })
  const v2DataQuery = useQuery({
    ...getV2RegistrationDataQueryOptions({ name }),
    enabled: enabled && isV2,
  })

  const expirySeconds = isV2
    ? (v2DataQuery.data?.expiry ?? null)
    : v1ExpiryQuery.data?.expiry
      ? Number(v1ExpiryQuery.data.expiry)
      : null
  const expiryDate =
    expirySeconds !== null ? new Date(expirySeconds * 1000) : undefined

  const selectedName: SelectedName = { name, isV2, expiryDate }

  // v2 renews throughout registered + grace, so the client-side window is
  // authoritative; v1 additionally requires the renewer's on-chain isRenewable.
  const { isRenewable, isLoading } = useV1Renewable(
    enabled && !isV2 ? [name] : [],
  )

  const canExtend = isExtendable2LD(selectedName) && (isV2 || isRenewable(name))

  return { canExtend, selectedName, expiryDate, isLoading }
}
