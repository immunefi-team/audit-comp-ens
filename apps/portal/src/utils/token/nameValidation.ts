import { isRegistrable } from '@/utils/ens/tldHelpers'

import { getLabel } from './getLabel'
import { getLabelRegistrationError, isValidEnsName } from './isNormalized'

/**
 * Validates that a name is a valid .eth name that can be registered.
 * Must be: normalized, valid labels, 2LD, and end with .eth.
 * Returns an error message if invalid, undefined if valid.
 */
export const validateRegistrableEthName = (
  name: string,
): string | undefined => {
  if (!name.trim()) {
    return 'Enter a name to register.'
  }

  // Registration-specific label rules (e.g. bracket-form labels are valid to
  // DISPLAY as encoded labelhashes but must never be registered literally).
  const labelError = getLabelRegistrationError(name.split('.')[0] ?? '')
  if (labelError) {
    return labelError
  }

  if (!isValidEnsName(name)) {
    return 'Names must be normalized (lowercase, valid characters).'
  }

  if (!isRegistrable(name)) {
    return 'Only .eth names can be registered (e.g. name.eth).'
  }

  return undefined
}

/**
 * Validates that a name meets ENS minimum length (3+ chars for the first label).
 * Returns an error message if invalid, null if valid.
 * Uses ens_normalize/ens_split for proper label extraction.
 */
export const validateNameLength = (name: string): string | null => {
  let label: string
  try {
    label = getLabel(name)
  } catch {
    return 'Invalid name'
  }
  if (label.length > 0 && label.length < 3) {
    return 'Names must be 3 characters or more to register.'
  }
  return null
}
