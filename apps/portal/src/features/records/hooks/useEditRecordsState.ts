import { useCallback, useMemo, useReducer } from 'react'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'
import {
  createNewRecord,
  type EditableRecord,
  getRecordId,
  mergeRecordsWithChanges,
  type RecordType,
} from '@/utils/records/editRecordUtils'

// ============================================================================
// State Types
// ============================================================================

export type EditRecordsState = {
  /** Records added by the user */
  newRecords: EditableRecord[]
  /** Map of record ID to edited value */
  editedValues: Map<string, string>
  /** Set of record IDs marked for deletion */
  deletedIds: Set<string>
}

// ============================================================================
// Action Types (Discriminated Union)
// ============================================================================

export type EditRecordsAction =
  | { type: 'ADD_RECORD'; recordType: RecordType; key: string; value: string }
  | { type: 'DELETE_RECORD'; record: EditableRecord }
  | {
      type: 'UPDATE_RECORD'
      record: EditableRecord
      newValue: string
      originalRecords: NameRecord[]
    }
  | { type: 'DISCARD_ALL' }

// ============================================================================
// Initial State
// ============================================================================

export const initialEditRecordsState: EditRecordsState = {
  newRecords: [],
  editedValues: new Map(),
  deletedIds: new Set(),
}

// ============================================================================
// Reducer (Pure Function)
// ============================================================================

export function editRecordsReducer(
  state: EditRecordsState,
  action: EditRecordsAction,
): EditRecordsState {
  switch (action.type) {
    case 'ADD_RECORD': {
      const newRecord = createNewRecord(
        action.recordType,
        action.key,
        action.value,
      )
      return {
        ...state,
        newRecords: [...state.newRecords, newRecord],
      }
    }

    case 'DELETE_RECORD': {
      const id = getRecordId(action.record)

      // If it's a new record, remove it from newRecords
      if (action.record.isNew) {
        return {
          ...state,
          newRecords: state.newRecords.filter((r) => getRecordId(r) !== id),
        }
      }

      // Mark existing record for deletion and remove any pending edits
      const nextEditedValues = new Map(state.editedValues)
      nextEditedValues.delete(id)

      return {
        ...state,
        editedValues: nextEditedValues,
        deletedIds: new Set(state.deletedIds).add(id),
      }
    }

    case 'UPDATE_RECORD': {
      const id = getRecordId(action.record)

      // If it's a new record, update it in newRecords
      if (action.record.isNew) {
        return {
          ...state,
          newRecords: state.newRecords.map((r) =>
            getRecordId(r) === id ? { ...r, value: action.newValue } : r,
          ),
        }
      }

      // Find original value
      const originalRecord = action.originalRecords.find(
        (r) => getRecordId(r) === id,
      )
      const originalValue = originalRecord?.value ?? ''

      // If value matches original, remove from editedValues
      if (action.newValue === originalValue) {
        const nextEditedValues = new Map(state.editedValues)
        nextEditedValues.delete(id)
        return {
          ...state,
          editedValues: nextEditedValues,
        }
      }

      // Otherwise, track the edit
      return {
        ...state,
        editedValues: new Map(state.editedValues).set(id, action.newValue),
      }
    }

    case 'DISCARD_ALL': {
      return initialEditRecordsState
    }

    default: {
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

// ============================================================================
// Custom Hook
// ============================================================================

export function useEditRecordsState(originalRecords: NameRecord[]) {
  const [state, dispatch] = useReducer(
    editRecordsReducer,
    initialEditRecordsState,
  )

  // Memoized merged records
  const records = useMemo(
    () =>
      mergeRecordsWithChanges(
        originalRecords,
        state.newRecords,
        state.editedValues,
        state.deletedIds,
      ),
    [originalRecords, state.newRecords, state.editedValues, state.deletedIds],
  )

  // Computed counts
  const changesCount =
    state.newRecords.length + state.editedValues.size + state.deletedIds.size
  const updatesCount = changesCount // For now, 1:1 mapping

  // Action dispatchers
  const addRecord = (recordType: RecordType, key: string, value: string) => {
    dispatch({ type: 'ADD_RECORD', recordType, key, value })
  }

  const deleteRecord = (record: EditableRecord) => {
    dispatch({ type: 'DELETE_RECORD', record })
  }

  // useCallback needed because this is passed to EditRecordsTable's memoized columns
  const updateRecord = useCallback(
    (record: EditableRecord, newValue: string) => {
      dispatch({ type: 'UPDATE_RECORD', record, newValue, originalRecords })
    },
    [originalRecords],
  )

  const discardAll = () => {
    dispatch({ type: 'DISCARD_ALL' })
  }

  // Data for save operation
  const pendingChanges = useMemo(
    () => ({
      newRecords: state.newRecords,
      editedValues: state.editedValues,
      deletedIds: state.deletedIds,
    }),
    [state.newRecords, state.editedValues, state.deletedIds],
  )

  return {
    // State
    records,
    changesCount,
    updatesCount,
    pendingChanges,

    // Actions
    addRecord,
    deleteRecord,
    updateRecord,
    discardAll,
  }
}
