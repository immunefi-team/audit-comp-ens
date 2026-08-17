import { describe, expect, it } from 'vitest'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'
import type { EditableRecord } from '@/utils/records/editRecordUtils'
import {
  type EditRecordsAction,
  type EditRecordsState,
  editRecordsReducer,
  initialEditRecordsState,
} from './useEditRecordsState'

describe('editRecordsReducer', () => {
  describe('ADD_RECORD', () => {
    it('adds a text record to newRecords', () => {
      const action: EditRecordsAction = {
        type: 'ADD_RECORD',
        recordType: 'text',
        key: 'name',
        value: 'John',
      }

      const result = editRecordsReducer(initialEditRecordsState, action)

      expect(result.newRecords).toHaveLength(1)
      expect(result.newRecords[0]).toMatchObject({
        type: 'text',
        key: 'name',
        value: 'John',
      })
      expect(result.newRecords[0]._uid).toBeDefined()
    })

    it('adds an address record with default coin type', () => {
      const action: EditRecordsAction = {
        type: 'ADD_RECORD',
        recordType: 'address',
        key: 'ETH',
        value: '0x123',
      }

      const result = editRecordsReducer(initialEditRecordsState, action)

      expect(result.newRecords[0]).toMatchObject({
        type: 'address',
        key: 'ETH',
        value: '0x123',
        id: 60,
      })
      expect(result.newRecords[0]._uid).toBeDefined()
    })

    it('adds a contentHash record', () => {
      const action: EditRecordsAction = {
        type: 'ADD_RECORD',
        recordType: 'contentHash',
        key: '',
        value: 'ipfs://abc',
      }

      const result = editRecordsReducer(initialEditRecordsState, action)

      expect(result.newRecords[0]).toMatchObject({
        type: 'contentHash',
        value: 'ipfs://abc',
      })
      expect(result.newRecords[0]._uid).toBeDefined()
    })

    it('preserves existing newRecords when adding', () => {
      const state: EditRecordsState = {
        ...initialEditRecordsState,
        newRecords: [{ type: 'text', key: 'existing', value: 'val' }],
      }

      const action: EditRecordsAction = {
        type: 'ADD_RECORD',
        recordType: 'text',
        key: 'new',
        value: 'newval',
      }

      const result = editRecordsReducer(state, action)

      expect(result.newRecords).toHaveLength(2)
      expect(result.newRecords[0]).toMatchObject({ key: 'existing' })
      expect(result.newRecords[1]).toMatchObject({ key: 'new' })
    })
  })

  describe('DELETE_RECORD', () => {
    it('removes a new record from newRecords', () => {
      const newRecord: EditableRecord = {
        type: 'text',
        key: 'name',
        value: 'John',
        isNew: true,
      }
      const state: EditRecordsState = {
        ...initialEditRecordsState,
        newRecords: [newRecord],
      }

      const action: EditRecordsAction = {
        type: 'DELETE_RECORD',
        record: newRecord,
      }

      const result = editRecordsReducer(state, action)

      expect(result.newRecords).toHaveLength(0)
    })

    it('adds existing record ID to deletedIds', () => {
      const existingRecord: EditableRecord = {
        type: 'text',
        key: 'name',
        value: 'John',
      }

      const action: EditRecordsAction = {
        type: 'DELETE_RECORD',
        record: existingRecord,
      }

      const result = editRecordsReducer(initialEditRecordsState, action)

      expect(result.deletedIds.has('text-name')).toBe(true)
    })

    it('removes pending edits when deleting', () => {
      const existingRecord: EditableRecord = {
        type: 'text',
        key: 'name',
        value: 'John',
      }
      const state: EditRecordsState = {
        ...initialEditRecordsState,
        editedValues: new Map([['text-name', 'Jane']]),
      }

      const action: EditRecordsAction = {
        type: 'DELETE_RECORD',
        record: existingRecord,
      }

      const result = editRecordsReducer(state, action)

      expect(result.editedValues.has('text-name')).toBe(false)
      expect(result.deletedIds.has('text-name')).toBe(true)
    })
  })

  describe('UPDATE_RECORD', () => {
    const originalRecords: NameRecord[] = [
      { type: 'text', key: 'name', value: 'John' },
    ]

    it('updates a new record in newRecords', () => {
      const newRecord: EditableRecord = {
        type: 'text',
        key: 'bio',
        value: 'Hello',
        isNew: true,
      }
      const state: EditRecordsState = {
        ...initialEditRecordsState,
        newRecords: [newRecord],
      }

      const action: EditRecordsAction = {
        type: 'UPDATE_RECORD',
        record: newRecord,
        newValue: 'World',
        originalRecords,
      }

      const result = editRecordsReducer(state, action)

      expect(result.newRecords[0].value).toBe('World')
    })

    it('adds edit to editedValues for existing record', () => {
      const existingRecord: EditableRecord = {
        type: 'text',
        key: 'name',
        value: 'John',
      }

      const action: EditRecordsAction = {
        type: 'UPDATE_RECORD',
        record: existingRecord,
        newValue: 'Jane',
        originalRecords,
      }

      const result = editRecordsReducer(initialEditRecordsState, action)

      expect(result.editedValues.get('text-name')).toBe('Jane')
    })

    it('removes edit when value matches original', () => {
      const existingRecord: EditableRecord = {
        type: 'text',
        key: 'name',
        value: 'Jane', // Current edited value
      }
      const state: EditRecordsState = {
        ...initialEditRecordsState,
        editedValues: new Map([['text-name', 'Jane']]),
      }

      const action: EditRecordsAction = {
        type: 'UPDATE_RECORD',
        record: existingRecord,
        newValue: 'John', // Back to original
        originalRecords,
      }

      const result = editRecordsReducer(state, action)

      expect(result.editedValues.has('text-name')).toBe(false)
    })
  })

  describe('DISCARD_ALL', () => {
    it('resets state to initial', () => {
      const state: EditRecordsState = {
        newRecords: [{ type: 'text', key: 'name', value: 'John' }],
        editedValues: new Map([['text-bio', 'Hello']]),
        deletedIds: new Set(['text-avatar']),
      }

      const action: EditRecordsAction = { type: 'DISCARD_ALL' }

      const result = editRecordsReducer(state, action)

      expect(result).toEqual(initialEditRecordsState)
      expect(result.newRecords).toHaveLength(0)
      expect(result.editedValues.size).toBe(0)
      expect(result.deletedIds.size).toBe(0)
    })
  })
})
