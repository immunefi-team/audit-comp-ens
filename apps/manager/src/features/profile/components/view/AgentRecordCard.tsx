import { Trans } from '@lingui/react/macro'
import { Bot } from 'lucide-react'
import { CopyableButton } from '@/components/atoms/CopyableButton'
import type { AgentRegistrationRecord } from '@/features/profile/types'

interface AgentRecordCardProps {
  readonly record: AgentRegistrationRecord
}

const fieldLabelClassName = 'text-muted-foreground text-xs leading-normal'
const fieldValueClassName = 'truncate font-medium text-foreground text-sm'

/**
 * Renders a single ENSIP-25 agent-registration record as a labelled card with
 * two explicit fields — Registry and Agent ID — plus a copy button that copies
 * the full raw text-record value (the key) to the clipboard (WEB-569 req 2 & 4).
 */
export const AgentRecordCard = ({ record }: AgentRecordCardProps) => (
  <div
    // border-[0.25px]: hairline border, matches ProfileCard's card surface
    className="rounded-xl border-[0.25px] border-border bg-white p-4"
    data-testid={`agent-record-card-${record.agentId}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ens-lapis-100 text-ens-lapis-500">
          <Bot className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="min-w-0">
            <p className={fieldLabelClassName}>
              <Trans>Registry</Trans>
            </p>
            <p className={fieldValueClassName} title={record.registryAddress}>
              {record.registryDisplayName}
            </p>
          </div>
          <div className="min-w-0">
            <p className={fieldLabelClassName}>
              <Trans>Agent ID</Trans>
            </p>
            <p className={`${fieldValueClassName} font-mono`}>
              {record.agentId}
            </p>
          </div>
        </div>
      </div>
      <CopyableButton
        aria-label="Copy agent record"
        className="shrink-0"
        data-testid={`agent-record-copy-${record.agentId}`}
        iconClassName="size-4"
        value={record.key}
      >
        <Trans>Copy</Trans>
      </CopyableButton>
    </div>
  </div>
)
