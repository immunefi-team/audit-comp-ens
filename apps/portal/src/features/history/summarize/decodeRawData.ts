import { isEncodedLabelhash } from '@ensdomains/ensjs/utils'
import { isHex } from 'viem'
import { decodeRoleBitmap } from '@/lib/roles/decodeRoleBitmap'

/**
 * Helpers for reading the indexer's raw `Event.data` JSON blob.
 *
 * The indexer decodes ~13 common event types into typed `as*` payloads, but others
 * (ContenthashChanged, NameChanged, SubregistryUpdated, EACRolesChanged, …) are only
 * available as a JSON string in `data`. We parse it here.
 *
 * TODO(indexer): once typed decoders exist for these, delete the corresponding readers.
 */

export const parseEventData = (
  data?: string | null,
): Record<string, unknown> => {
  if (!data) return {}
  try {
    const parsed: unknown = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const readString = (
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

export type RoleChange = {
  readonly account?: string
  readonly direction: 'grant' | 'revoke' | 'unknown'
  readonly roles: readonly string[]
}

/**
 * Best-effort decode of an `EACRolesChanged` event from its raw `data`.
 * Determines grant vs revoke from the old→new bitmap delta. Field names match
 * the indexer payload (see `lib/roles/filterEventsByResource.ts`).
 *
 * TODO(indexer): expose asRolesChanged { account resource oldRoleBitmap newRoleBitmap }
 * so this JSON parsing becomes unnecessary.
 */
export const decodeRoleChange = (data?: string | null): RoleChange => {
  const obj = parseEventData(data)
  const account = readString(obj, 'account')
  const oldBitmap = readString(obj, 'oldRoleBitmap')
  const newBitmap = readString(obj, 'newRoleBitmap')

  const safeDecode = (bitmap?: string): string[] => {
    if (!bitmap) return []
    try {
      return decodeRoleBitmap(bitmap)
    } catch {
      return []
    }
  }

  const before = new Set(safeDecode(oldBitmap))
  const after = safeDecode(newBitmap)
  const afterSet = new Set(after)
  const granted = after.filter((role) => !before.has(role))
  const revoked = [...before].filter((role) => !afterSet.has(role))

  if (granted.length > 0 && revoked.length === 0)
    return { account, direction: 'grant', roles: granted }
  if (revoked.length > 0 && granted.length === 0)
    return { account, direction: 'revoke', roles: revoked }
  // Mixed or indeterminate change — surface the resulting role set.
  return { account, direction: 'unknown', roles: after }
}

/**
 * Resolve a decoded `name`/`label` param to the full ENS name it refers to: full
 * names pass through; a bare label resolves against the event's domain — the domain
 * itself when the label is its leading label, otherwise a child under it.
 */
export const resolveDecodedName = (
  value: string,
  eventName?: string | null,
): string | undefined => {
  if (!value) return undefined
  // Raw hex (labelhashes/node hashes) and encoded unknown labels ("[<labelhash>]")
  // are not display labels.
  if (isHex(value) || isEncodedLabelhash(value)) return undefined
  if (value.includes('.')) return value
  if (!eventName) return undefined
  if (eventName === value || eventName.startsWith(`${value}.`)) return eventName
  return `${value}.${eventName}`
}
