import { TaggedError } from '@ens-apps/utils/neverthrow'
import { err, ok } from 'neverthrow'
import { isRenewableV2EthName } from '@/features/grace/utils/gracePeriod'
import { parseName } from '@/features/register-v2/utils/name-parser'

type RenewableNameErrorReason = 'TLD_NOT_SUPPORTED' | 'SUBNAMES_NOT_SUPPORTED'

export class RenewableNameError<
  TReason extends RenewableNameErrorReason,
> extends TaggedError('RenewableNameError')<{
  reason: TReason
}> {
  override get message() {
    return {
      TLD_NOT_SUPPORTED: 'Only .eth names are supported',
      SUBNAMES_NOT_SUPPORTED: 'Subnames are not supported',
    }[this.reason]
  }

  static err<const T extends RenewableNameErrorReason>(reason: T) {
    return err(new RenewableNameError({ reason }))
  }
}

export const parseRenewableName = (name: string) =>
  parseName(name).andThen((parsedName) => {
    if (parsedName.tld !== 'eth') {
      return RenewableNameError.err('TLD_NOT_SUPPORTED')
    }

    if (parsedName.subLabels.length > 0) {
      return RenewableNameError.err('SUBNAMES_NOT_SUPPORTED')
    }

    return ok(parsedName)
  })

export const isRenewableName = (name: string) => parseRenewableName(name).isOk()

export const canRenewV2Name = (
  name: string,
  expiryDate: Date | null | undefined,
) => {
  const parsed = parseRenewableName(name)
  if (parsed.isErr()) return false
  return isRenewableV2EthName(`${parsed.value.label}.eth`, expiryDate)
}

/**
 * Expiry-aware bulk-selection eligibility for a dashboard domain. Mirrors the
 * single-name route's `canRenewV2Name` check so a name can only be selected for
 * bulk renewal if it's still renewable (syntax + within the v2 grace window),
 * not merely a `.eth` 2LD. `expirySeconds` is the on-chain expiry in seconds.
 */
export const isRenewableV2Domain = (
  name: string,
  expirySeconds: number | null | undefined,
): boolean =>
  canRenewV2Name(
    name,
    expirySeconds == null ? null : new Date(expirySeconds * 1000),
  )
