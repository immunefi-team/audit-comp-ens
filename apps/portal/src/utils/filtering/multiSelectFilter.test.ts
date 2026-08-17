import { describe, expect, it } from 'vitest'
import {
  type FilterGroup,
  getAllValuesFromGroups,
  isGroupFullySelected,
  toggleGroupSelection,
  toggleValue,
} from './multiSelectFilter'

describe('multiSelectFilter', () => {
  describe('getAllValuesFromGroups', () => {
    it('should flatten multiple groups into single array of values', () => {
      const groups: FilterGroup[] = [
        {
          title: 'Group 1',
          options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
          ],
        },
        {
          title: 'Group 2',
          options: [
            { label: 'Option C', value: 'c' },
            { label: 'Option D', value: 'd' },
          ],
        },
      ]

      const result = getAllValuesFromGroups(groups)

      expect(result).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should return empty array for empty groups', () => {
      const result = getAllValuesFromGroups([])

      expect(result).toEqual([])
    })

    it('should handle groups with no options', () => {
      const groups: FilterGroup[] = [
        { title: 'Empty Group', options: [] },
        {
          title: 'Group 2',
          options: [{ label: 'Option A', value: 'a' }],
        },
      ]

      const result = getAllValuesFromGroups(groups)

      expect(result).toEqual(['a'])
    })

    it('should preserve order of values', () => {
      const groups: FilterGroup[] = [
        {
          title: 'Group 1',
          options: [
            { label: 'Z', value: 'z' },
            { label: 'A', value: 'a' },
          ],
        },
      ]

      const result = getAllValuesFromGroups(groups)

      expect(result).toEqual(['z', 'a']) // Preserves original order
    })
  })

  describe('toggleValue', () => {
    it('should add value when not present', () => {
      const selectedValues = ['a', 'b']

      const result = toggleValue(selectedValues, 'c')

      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should remove value when present', () => {
      const selectedValues = ['a', 'b', 'c']

      const result = toggleValue(selectedValues, 'b')

      expect(result).toEqual(['a', 'c'])
    })

    it('should not mutate original array', () => {
      const selectedValues = ['a', 'b']

      const result = toggleValue(selectedValues, 'c')

      expect(selectedValues).toEqual(['a', 'b']) // Original unchanged
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should handle empty array', () => {
      const result = toggleValue([], 'a')

      expect(result).toEqual(['a'])
    })

    it('should handle toggling last remaining value', () => {
      const result = toggleValue(['a'], 'a')

      expect(result).toEqual([])
    })
  })

  describe('toggleGroupSelection', () => {
    it('should select all group values when none are selected', () => {
      const selectedValues = ['x']
      const groupValues = ['a', 'b', 'c']

      const result = toggleGroupSelection(selectedValues, groupValues)

      expect(result).toEqual(['x', 'a', 'b', 'c'])
    })

    it('should select all group values when some are selected', () => {
      const selectedValues = ['a', 'x']
      const groupValues = ['a', 'b', 'c']

      const result = toggleGroupSelection(selectedValues, groupValues)

      expect(result).toEqual(['a', 'x', 'b', 'c'])
    })

    it('should deselect all group values when all are selected', () => {
      const selectedValues = ['x', 'a', 'b', 'c']
      const groupValues = ['a', 'b', 'c']

      const result = toggleGroupSelection(selectedValues, groupValues)

      expect(result).toEqual(['x']) // Only 'x' remains
    })

    it('should not mutate original array', () => {
      const selectedValues = ['a', 'b']
      const groupValues = ['c', 'd']

      const result = toggleGroupSelection(selectedValues, groupValues)

      expect(selectedValues).toEqual(['a', 'b']) // Original unchanged
      expect(result).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle empty group values', () => {
      const selectedValues = ['a', 'b']
      const groupValues: string[] = []

      const result = toggleGroupSelection(selectedValues, groupValues)

      // Empty group is considered "all selected", so it deselects (no-op)
      expect(result).toEqual(['a', 'b'])
    })

    it('should avoid duplicate values when selecting', () => {
      const selectedValues = ['a', 'b']
      const groupValues = ['b', 'c']

      const result = toggleGroupSelection(selectedValues, groupValues)

      expect(result).toEqual(['a', 'b', 'c']) // 'b' not duplicated
    })
  })

  describe('isGroupFullySelected', () => {
    it('should return true when all group values are selected', () => {
      const selectedValues = ['a', 'b', 'c', 'd']
      const groupValues = ['b', 'c']

      const result = isGroupFullySelected(selectedValues, groupValues)

      expect(result).toBe(true)
    })

    it('should return false when some group values are not selected', () => {
      const selectedValues = ['a', 'b']
      const groupValues = ['b', 'c']

      const result = isGroupFullySelected(selectedValues, groupValues)

      expect(result).toBe(false)
    })

    it('should return false when no group values are selected', () => {
      const selectedValues = ['a']
      const groupValues = ['b', 'c']

      const result = isGroupFullySelected(selectedValues, groupValues)

      expect(result).toBe(false)
    })

    it('should return true for empty group values', () => {
      const selectedValues = ['a', 'b']
      const groupValues: string[] = []

      const result = isGroupFullySelected(selectedValues, groupValues)

      expect(result).toBe(true) // .every() returns true for empty arrays
    })

    it('should return false when selected values is empty but group is not', () => {
      const selectedValues: string[] = []
      const groupValues = ['a', 'b']

      const result = isGroupFullySelected(selectedValues, groupValues)

      expect(result).toBe(false)
    })
  })
})
