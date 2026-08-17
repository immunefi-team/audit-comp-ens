import type { Address, Prettify } from 'viem'
import type {
  Section,
  SpecialSection,
  StaticRecordKey,
  TextRecordDef,
} from './data/records/types'
import type { AgentRegistrationRecord } from './utils/agentRegistration/transformAgentRegistrationRecord'

export type { AgentRegistrationRecord }

// Record value types
export type TextRecordValue = {
  readonly key: string
  readonly value: string
}

export type AddressRecordValue = {
  readonly coinType: number
  readonly value: string
}

export type LinkItem = {
  readonly name: string
  readonly url: string
}

export type ProfileRecords = Prettify<
  {
    [key in Section | SpecialSection]: TextRecordValue[]
  } & {
    base: {
      [key in StaticRecordKey]?: string
    }
    addresses: AddressRecordValue[]
    links: LinkItem[]
    contentHash?: string
    abi?: string
    unknown: TextRecordValue[] // For any custom records
    // ENSIP-25 agent-registration records, detected by the `agent-registration`
    // key prefix and rendered with custom UI (see AgentRecordCard).
    agentRegistrations: AgentRegistrationRecord[]
    resolverAddress?: Address
  }
>

// Helper types
export type RecordValue = TextRecordValue | AddressRecordValue

// Form field configuration for dynamic rendering
export type FormFieldConfig = {
  record: TextRecordDef
  value: RecordValue
  onChange: (value: RecordValue) => void
  onRemove: () => void
  error?: string
}
