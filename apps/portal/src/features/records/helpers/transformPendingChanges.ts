/**
 * Transform pending record changes to ensjs setRecords format.
 *
 * Converts our internal change tracking state (newRecords, editedValues, deletedIds)
 * to the format expected by ensjs `setRecords`.
 */

import type { NameRecord } from '@/features/records/components/RecordsTable/columns'
import type { EditableRecord } from '@/utils/records/editRecordUtils'
import { getRecordId } from '@/utils/records/editRecordUtils'

/** ABI encoding format as expected by ensjs */
type AbiInputJson = {
  encodeAs: 'json'
  data: Record<string, unknown> | Record<string, unknown>[] | null
}

type AbiInput = AbiInputJson

export type SetRecordsInput = {
  texts?: Array<{ key: string; value: string }>
  coins?: Array<{ coin: number; value: string }>
  contentHash?: string | null
  abi?: AbiInput
}

type PendingChanges = {
  newRecords: EditableRecord[]
  editedValues: Map<string, string>
  deletedIds: Set<string>
}

/**
 * Transforms pending changes into the format expected by ensjs setRecords.
 *
 * @param originalRecords - The original records from the server
 * @param pendingChanges - The pending changes from our state
 * @returns SetRecordsInput ready for ensjs
 *
 * @example
 * const input = transformPendingChangesToSetRecords(originalRecords, {
 *   newRecords: [{ type: 'text', key: 'twitter', value: '@ens' }],
 *   editedValues: new Map([['text-name', 'New Name']]),
 *   deletedIds: new Set(['text-description']),
 * })
 * // { texts: [{ key: 'twitter', value: '@ens' }, { key: 'name', value: 'New Name' }, { key: 'description', value: '' }] }
 */
export function transformPendingChangesToSetRecords(
  originalRecords: NameRecord[],
  pendingChanges: PendingChanges,
): SetRecordsInput {
  const { newRecords, editedValues, deletedIds } = pendingChanges

  const texts: Array<{ key: string; value: string }> = []
  const coins: Array<{ coin: number; value: string }> = []
  let contentHash: string | null | undefined
  let abi: AbiInput | undefined

  /**
   * Parse ABI JSON string to object for ensjs.
   * Returns null data if empty/invalid (to delete the ABI).
   */
  const parseAbiValue = (value: string): AbiInput | undefined => {
    if (!value || value.trim() === '') {
      return { encodeAs: 'json', data: null }
    }
    try {
      const parsed = JSON.parse(value) as
        | Record<string, unknown>
        | Record<string, unknown>[]
      return { encodeAs: 'json', data: parsed }
    } catch {
      // Invalid JSON - treat as null to avoid errors
      console.warn('Invalid ABI JSON:', value)
      return undefined
    }
  }

  // Process new records
  for (const record of newRecords) {
    switch (record.type) {
      case 'text':
        texts.push({ key: record.key, value: record.value })
        break
      case 'address':
        coins.push({ coin: record.id, value: record.value })
        break
      case 'contentHash':
        contentHash = record.value
        break
      case 'abi':
        abi = parseAbiValue(record.value)
        break
    }
  }

  // Process edited records
  for (const [id, newValue] of editedValues) {
    // Find the original record to get its type and key
    const originalRecord = originalRecords.find((r) => getRecordId(r) === id)
    if (!originalRecord) continue

    switch (originalRecord.type) {
      case 'text':
        texts.push({ key: originalRecord.key, value: newValue })
        break
      case 'address':
        coins.push({ coin: originalRecord.id, value: newValue })
        break
      case 'contentHash':
        contentHash = newValue
        break
      case 'abi':
        abi = parseAbiValue(newValue)
        break
    }
  }

  // Process deleted records (set to empty string to delete)
  for (const id of deletedIds) {
    const originalRecord = originalRecords.find((r) => getRecordId(r) === id)
    if (!originalRecord) continue

    switch (originalRecord.type) {
      case 'text':
        texts.push({ key: originalRecord.key, value: '' })
        break
      case 'address':
        coins.push({ coin: originalRecord.id, value: '' })
        break
      case 'contentHash':
        contentHash = null
        break
      case 'abi':
        abi = { encodeAs: 'json', data: null }
        break
    }
  }

  const result: SetRecordsInput = {}

  if (texts.length > 0) {
    result.texts = texts
  }

  if (coins.length > 0) {
    result.coins = coins
  }

  if (contentHash !== undefined) {
    result.contentHash = contentHash
  }

  if (abi !== undefined) {
    result.abi = abi
  }

  return result
}
