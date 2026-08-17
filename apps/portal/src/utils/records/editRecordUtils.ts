import { coinNameToTypeMap } from '@ensdomains/address-encoder'
import { match } from 'ts-pattern'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'

/** Editable record that extends NameRecord with edit state */
export type EditableRecord = NameRecord & {
  isEdited?: boolean
  isNew?: boolean
  isDeleted?: boolean
  /** Unique ID for new records to distinguish multiple records of the same type/key */
  _uid?: string
}

/** Record types available for creation */
export type RecordType = 'text' | 'address' | 'abi' | 'contentHash'

/**
 * Gets a unique identifier for a record based on its type, key, and optional _uid.
 *
 * For new records (with _uid), the _uid is appended to ensure uniqueness
 * when multiple records of the same type/key exist.
 *
 * @param record - The record to get an ID for
 * @returns A unique string identifier
 *
 * @example
 * getRecordId({ type: 'text', key: 'name', value: 'John' })
 * // 'text-name'
 *
 * @example
 * getRecordId({ type: 'address', key: 'ETH', value: '0x...', id: 60, _uid: 'abc123' })
 * // 'address-ETH-abc123'
 *
 * @example
 * getRecordId({ type: 'contentHash', value: 'ipfs://...', _uid: 'xyz789' })
 * // 'contentHash-xyz789'
 */
export const getRecordId = (record: NameRecord | EditableRecord): string => {
  const editableRecord = record as EditableRecord
  const uid = editableRecord._uid ? `-${editableRecord._uid}` : ''

  if (record.type === 'contentHash') {
    return `contentHash${uid}`
  }
  if (record.type === 'abi') {
    return `abi${uid}`
  }
  if (record.type === 'address') {
    return `address-${record.key}${uid}`
  }
  return `text-${record.key}${uid}`
}

/**
 * Merges original records with pending changes (edits, deletions, new records).
 * Returns a new array with appropriate flags set on each record.
 *
 * @param originalRecords - The original records from the server
 * @param newRecords - Records added by the user
 * @param editedValues - Map of record ID to new value for edited records
 * @param deletedIds - Set of record IDs marked for deletion
 * @returns Merged array with isEdited, isDeleted, or isNew flags set
 *
 * @example
 * mergeRecordsWithChanges(
 *   [{ type: 'text', key: 'name', value: 'John' }],
 *   [{ type: 'text', key: 'bio', value: 'Hello' }],
 *   new Map([['text-name', 'Jane']]),
 *   new Set(),
 * )
 * // [
 * //   { type: 'text', key: 'name', value: 'Jane', isEdited: true },
 * //   { type: 'text', key: 'bio', value: 'Hello', isNew: true },
 * // ]
 */
export function mergeRecordsWithChanges(
  originalRecords: NameRecord[],
  newRecords: EditableRecord[],
  editedValues: Map<string, string>,
  deletedIds: Set<string>,
): EditableRecord[] {
  const merged: EditableRecord[] = []

  // Add original records with edit/delete state
  for (const record of originalRecords) {
    const id = getRecordId(record)
    if (deletedIds.has(id)) {
      merged.push({ ...record, isDeleted: true })
    } else if (editedValues.has(id)) {
      merged.push({
        ...record,
        value: editedValues.get(id) ?? record.value,
        isEdited: true,
      })
    } else {
      merged.push(record)
    }
  }

  // Add new records
  for (const record of newRecords) {
    merged.push({ ...record, isNew: true })
  }

  return merged
}

/** Generate a unique ID for new records */
function generateUid(): string {
  return Math.random().toString(36).substring(2, 11)
}

/**
 * Creates a new record object based on the specified type.
 * Uses exhaustive pattern matching to ensure all types are handled.
 * Each new record gets a unique _uid to distinguish it from other records.
 *
 * @param type - The type of record to create
 * @param key - The key/name for the record (ignored for contentHash)
 * @param value - The value for the record
 * @returns A new EditableRecord object with a unique _uid
 *
 * @example
 * createNewRecord('text', 'name', 'John')
 * // { type: 'text', key: 'name', value: 'John', _uid: 'abc123xyz' }
 *
 * @example
 * createNewRecord('address', 'ETH', '0x123...')
 * // { type: 'address', key: 'ETH', value: '0x123...', id: 60, _uid: 'def456uvw' }
 *
 * @example
 * createNewRecord('contentHash', '', 'ipfs://...')
 * // { type: 'contentHash', value: 'ipfs://...', _uid: 'ghi789rst' }
 */
export function createNewRecord(
  type: RecordType,
  key: string,
  value: string,
): EditableRecord {
  const _uid = generateUid()

  return match(type)
    .with('text', () => ({ type: 'text' as const, key, value, _uid }))
    .with('address', () => {
      // Look up coin type from key, default to ETH (60) if not found
      const coinType =
        coinNameToTypeMap[
          key.toLowerCase() as keyof typeof coinNameToTypeMap
        ] ?? 60
      return {
        type: 'address' as const,
        key,
        value,
        id: coinType,
        _uid,
      }
    })
    .with('contentHash', () => ({ type: 'contentHash' as const, value, _uid }))
    .with('abi', () => ({ type: 'abi' as const, value, _uid }))
    .exhaustive()
}
