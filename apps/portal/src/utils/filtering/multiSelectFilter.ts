export type FilterGroup = {
  title: string
  options: Array<{ label: string; value: string }>
}

/**
 * Flattens all filter groups into a single array of values
 *
 * @param groups - Array of filter groups
 * @returns Flat array of all option values across all groups
 *
 * @example
 * getAllValuesFromGroups([
 *   { title: 'Group 1', options: [{ label: 'A', value: 'a' }] },
 *   { title: 'Group 2', options: [{ label: 'B', value: 'b' }] }
 * ])
 * // ['a', 'b']
 */
export const getAllValuesFromGroups = (groups: FilterGroup[]): string[] => {
  return groups.flatMap((group) => group.options.map((opt) => opt.value))
}

/**
 * Toggles a value in the selected values array (add if absent, remove if present)
 *
 * @param selectedValues - Current array of selected values
 * @param value - Value to toggle
 * @returns New array with value added or removed
 *
 * @example
 * toggleValue(['a', 'b'], 'c') // ['a', 'b', 'c']
 * toggleValue(['a', 'b'], 'b') // ['a']
 */
export const toggleValue = (
  selectedValues: string[],
  value: string,
): string[] => {
  if (selectedValues.includes(value)) {
    return selectedValues.filter((v) => v !== value)
  }
  return [...selectedValues, value]
}

/**
 * Toggles selection for an entire group of values
 * If all group values are selected, deselects them
 * If some or none are selected, selects all
 *
 * @param selectedValues - Current array of selected values
 * @param groupValues - Array of values in the group to toggle
 * @returns New array with group values toggled
 *
 * @example
 * // Select all in group
 * toggleGroupSelection(['a'], ['b', 'c']) // ['a', 'b', 'c']
 *
 * // Deselect all in group
 * toggleGroupSelection(['a', 'b', 'c'], ['b', 'c']) // ['a']
 */
export const toggleGroupSelection = (
  selectedValues: string[],
  groupValues: string[],
): string[] => {
  const allSelected = groupValues.every((val) => selectedValues.includes(val))

  if (allSelected) {
    // Deselect all group values
    return selectedValues.filter((v) => !groupValues.includes(v))
  }

  // Select all group values (avoid duplicates)
  const newValues = [...selectedValues]
  groupValues.forEach((val) => {
    if (!newValues.includes(val)) {
      newValues.push(val)
    }
  })
  return newValues
}

/**
 * Checks if all values in a group are currently selected
 *
 * @param selectedValues - Current array of selected values
 * @param groupValues - Array of values in the group to check
 * @returns True if all group values are selected
 *
 * @example
 * isGroupFullySelected(['a', 'b', 'c'], ['b', 'c']) // true
 * isGroupFullySelected(['a', 'b'], ['b', 'c']) // false
 */
export const isGroupFullySelected = (
  selectedValues: string[],
  groupValues: string[],
): boolean => {
  return groupValues.every((val) => selectedValues.includes(val))
}
