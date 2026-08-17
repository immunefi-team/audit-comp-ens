import { ens_normalize, ens_split } from '@adraffy/ens-normalize'

/**
 * A label of the form `[64 lowercase hex chars]` is an "encoded labelhash" —
 * the standard representation (emitted by the subgraph/indexer, understood by
 * viem's `namehash`) for a label that is only known by its hash. Such labels
 * can never be normalized (brackets are disallowed characters), but names
 * containing them are real, registered, resolvable on-chain names and must
 * not be rejected as invalid.
 */
const ENCODED_LABELHASH_RE = /^\[[0-9a-f]{64}\]$/

export const isEncodedLabelhash = (label: string) =>
  ENCODED_LABELHASH_RE.test(label)

const isNormalizedLabel = (label: string) => {
  try {
    return ens_normalize(label) === label
  } catch {
    return false
  }
}

export const isNormalized = (name: string) =>
  name
    .split('.')
    .every((label) => isEncodedLabelhash(label) || isNormalizedLabel(label))

/**
 * Check if a name is a valid ENS name.
 * Must be:
 * 1. Have at least one label (e.g., "eth", "example.eth", "sub.example.eth")
 * 2. Every label either normalized (lowercase, no invalid characters) or an
 *    encoded labelhash (`[…64 hex…]`)
 * 3. All normalizable labels must be valid (no normalization errors)
 *
 * Note: 1LDs like "eth" are valid ENS names - doesn't need to end with .eth
 */
export const isValidEnsName = (name: string) => {
  if (!name) {
    return false
  }

  return name.split('.').every((label) => {
    if (isEncodedLabelhash(label)) {
      return true
    }
    if (!label || !isNormalizedLabel(label)) {
      return false
    }
    try {
      return ens_split(label).every((part) => !part.error)
    } catch {
      return false
    }
  })
}

/**
 * Validation for a label being REGISTERED (create-subname and similar
 * inputs). Display/resolution contexts accept encoded labelhashes, but
 * registration must not: a literal `[…hash…]` label would later be
 * indistinguishable from a genuine encoded labelhash (a known ENS spoofing
 * vector), so bracket-wrapped labels are rejected outright.
 *
 * Returns a user-facing error message, or `null` when the label is
 * registrable.
 */
export const getLabelRegistrationError = (label: string): string | null => {
  if (!label) {
    return null
  }
  if (label.includes('.')) {
    return 'Subname must be a single label — dots are not allowed.'
  }
  if (label.startsWith('[') && label.endsWith(']')) {
    return 'Labels in [labelhash] form cannot be registered - this notation is reserved for displaying unknown labels.'
  }
  if (!isNormalizedLabel(label)) {
    return 'Label contains invalid or non-normalized characters.'
  }
  return null
}
