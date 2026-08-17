import { TaggedError } from '@ens-apps/utils/neverthrow'
import { err, ok, type Result } from 'neverthrow'

// ENS names rules:
// - Minimum 3 characters for the label (excluding .eth)
// - Allowed: letters, numbers, hyphens, emojis
// - Not allowed: spaces, special characters like &, *, etc.
// - No multiple consecutive dots
// - Any tld is allowed, if not present, it is assumed to be .eth

const INVALID_LABEL_CHARS = /[&*@#$%^()[\]{}|\\:;"'<>?,=+~`!]/

export class ParseNameError<TReason extends string> extends TaggedError(
  'ParseNameError',
)<{
  reason: TReason
}> {
  override get message() {
    return `Invalid ENS name: ${this.reason}`
  }

  static err<const T extends string>(reason: T) {
    return err(new ParseNameError({ reason }))
  }
}

type ParsedName = {
  subLabels: string[]
  label: string
  tld: string
}

export const parseName = (
  name: string,
): Result<
  ParsedName,
  ParseNameError<
    | 'SPACE_NOT_ALLOWED'
    | 'MULTIPLE_CONSECUTIVE_DOTS'
    | 'TLD_NOT_FOUND'
    | 'LABEL_NOT_FOUND'
    | 'INVALID_CHARACTER'
  >
> => {
  // Remove any leading or trailing whitespace
  const normalized = name.trim().toLowerCase()

  // Whitespace is not allowed inside names
  if (/\s/.test(normalized)) {
    return ParseNameError.err('SPACE_NOT_ALLOWED')
  }

  // Multiple consecutive dots are not allowed
  if (normalized.includes('..')) {
    return ParseNameError.err('MULTIPLE_CONSECUTIVE_DOTS')
  }

  const labels = normalized.split('.').filter(Boolean)
  const hasTld = labels.length > 1

  const tld = hasTld ? labels.pop() : 'eth'

  if (!tld) {
    return ParseNameError.err('TLD_NOT_FOUND')
  }

  const label = labels.pop()

  if (!label) {
    return ParseNameError.err('LABEL_NOT_FOUND')
  }

  if ([...labels, label, tld].some((part) => INVALID_LABEL_CHARS.test(part))) {
    return ParseNameError.err('INVALID_CHARACTER')
  }

  return ok({
    subLabels: labels,
    label,
    tld,
  })
}

/**
 * Correctly calculates the length of a ENS label by iterating over the string iterator and counting the number of code points.
 */
export const getLabelLength = (label: string) => {
  let length = 0
  for (const _ of label) {
    length++
  }
  return length
}
