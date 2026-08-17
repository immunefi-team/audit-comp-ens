import type { RecentActivityEvent } from '../hooks/useRecentActivity'

type ActivityEntity = {
  type: 'address' | 'name'
  value: string
}

export type FormattedActivity = {
  text: string
  /** Actor shown on the right side of the row (e.g. "registered by {actor}") */
  actor?: ActivityEntity
  /** Fallback entity for the name column when event.name is null */
  entityFromData?: ActivityEntity
}

const EVENT_DESCRIPTORS: Record<
  string,
  {
    text: string
    actorField?: string
    actorType?: 'address' | 'name'
    /** Extract a display entity from data when event.name is null */
    entityField?: string
    entityType?: 'address' | 'name'
    /** Append a raw data field value to the text (e.g. text record key) */
    textSuffixField?: string
  }
> = {
  // Registration
  NameRegistered: {
    text: 'Registered by',
    actorField: 'owner',
    actorType: 'address',
  },
  LabelRegistered: {
    text: 'Registered by',
    actorField: 'owner',
    actorType: 'address',
  },
  NameRenewed: { text: 'Name renewed' },

  // Ownership
  Transfer: {
    text: 'Ownership transferred to',
    actorField: 'to',
    actorType: 'address',
  },
  NewOwner: {
    text: 'Subname created by',
    actorField: 'owner',
    actorType: 'address',
  },

  // Resolver
  ResolverUpdated: {
    text: 'Resolver updated to',
    actorField: 'resolver',
    actorType: 'address',
  },
  AddrChanged: { text: 'ETH address updated' },
  AddressChanged: {
    text: 'ETH address updated',
    entityField: 'address',
    entityType: 'address',
  },
  TextChanged: { text: 'Text record updated', textSuffixField: 'key' },
  ContenthashChanged: { text: 'Contenthash updated' },
  VersionChanged: { text: 'Resolver records cleared' },

  // Name / reverse resolution — name lives inside data.name
  NameChanged: {
    text: 'Primary name updated',
    entityField: 'name',
    entityType: 'name',
  },

  // Migration
  NameWrapped: { text: 'Migrated from ENSv1 to ENSv2' },
  NameUnwrapped: { text: 'Unwrapped from ENSv2' },

  // Access control — account lives inside data.account
  EACRolesChanged: {
    text: 'Roles updated',
    entityField: 'account',
    entityType: 'address',
  },
  FusesSet: { text: 'Fuses updated' },
  ExpiryExtended: { text: 'Expiry extended' },
}

export const formatRelativeTime = (timestamp: number): string => {
  const diffSec = Math.floor((Date.now() - timestamp * 1000) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  return `${Math.floor(diffHour / 24)}d ago`
}

export const formatActivityEvent = (
  event: RecentActivityEvent,
): FormattedActivity => {
  const descriptor = EVENT_DESCRIPTORS[event.type]
  if (!descriptor) return { text: event.type }

  let parsedData: Record<string, string> = {}
  try {
    parsedData = JSON.parse(event.data) as Record<string, string>
  } catch {
    // data field is not valid JSON
  }

  let text = descriptor.text
  if (descriptor.textSuffixField) {
    const suffix = parsedData[descriptor.textSuffixField]
    if (suffix) text = `${descriptor.text} (${suffix})`
  }

  const result: FormattedActivity = { text }

  if (descriptor.actorField) {
    const actorValue = parsedData[descriptor.actorField]
    if (actorValue) {
      result.actor = {
        type: descriptor.actorType ?? 'address',
        value: actorValue,
      }
    }
  }

  if (descriptor.entityField) {
    const entityValue = parsedData[descriptor.entityField]
    if (entityValue) {
      result.entityFromData = {
        type: descriptor.entityType ?? 'name',
        value: entityValue,
      }
    }
  }

  return result
}
