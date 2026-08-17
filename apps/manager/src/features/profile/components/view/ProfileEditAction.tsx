import { Trans } from '@lingui/react/macro'
import type { Address } from 'viem'
import { EditProfileDialog } from '@/features/profile/components/dialogs/edit-profile/EditProfileDialog'
import { normalizeEthName } from '@/features/profile/service/profileName'
import type { ProfileRecords } from '@/features/profile/types'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'

type ProfileEditActionProps = {
  readonly className: string
  readonly isInGrace: boolean
  readonly isOwner?: boolean
  readonly name: string
  readonly onUpdated: () => undefined | Promise<unknown>
  readonly owner?: Address
  readonly protocol?: RenewalProtocol
  readonly records: ProfileRecords
}

export const ProfileEditAction = ({
  isInGrace,
  isOwner,
  name,
  onUpdated,
  owner,
  protocol,
  records,
  className,
}: ProfileEditActionProps) => {
  // An unmigrated .eth name has no v2 resolver to write to, so saving fails and
  // the upgrade banner says as much. Imported DNS names are also served by the
  // v1 registry but are editable, so the protocol alone can't decide this.
  const isUnmigratedEthName =
    protocol === 'v1' && normalizeEthName(name) !== null

  if (!isOwner || isInGrace || isUnmigratedEthName) return null

  const trigger = (
    <button className={className} type="button">
      <Trans>Edit Profile</Trans>
    </button>
  )

  return (
    <EditProfileDialog
      name={name}
      onUpdated={onUpdated}
      owner={owner}
      records={records}
      trigger={trigger}
    />
  )
}
