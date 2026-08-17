import { Trans } from '@lingui/react/macro'
import type { ProfileRecords } from '@/features/profile/types'
import { AgentRecordCard } from './AgentRecordCard'
import { ProfileCard } from './ProfileCard'

export const ProfileAgentSection = ({
  records,
}: {
  readonly records: ProfileRecords
}) => {
  if (records.agentRegistrations.length === 0) return null

  return (
    <ProfileCard title={<Trans>Agents</Trans>}>
      <div className="grid gap-4 lg:landscape:grid-cols-2 lg:landscape:gap-6">
        {records.agentRegistrations.map((record) => (
          <AgentRecordCard key={record.key} record={record} />
        ))}
      </div>
    </ProfileCard>
  )
}
