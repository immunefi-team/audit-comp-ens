import { type Address, checksumAddress, isAddress } from 'viem'
import { ensureEthSuffix } from '@/utils/ens/ensureEthSuffix'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { isValidEnsName } from '@/utils/token/isNormalized'

export type Suggestion = {
  id: string
  label: string
  description: string
  inputValue: string
  action: () => void
}

type NavigateToAddress = (address: string) => void
type NavigateToName = (name: string) => void
type NavigateToResolver = (address: string) => void

type BuildSuggestionsOptions = {
  value: string
  isMobile: boolean
  navigateToAddress: NavigateToAddress
  navigateToName: NavigateToName
  navigateToResolver?: NavigateToResolver
  /** When true, the searched address supports resolver interfaces. */
  isResolver?: boolean
  /** When set and value is a single label (no dots), suggest label.tld for each valid TLD. */
  validTlds?: readonly string[]
}

const SHORT_LABEL_NOTICE = 'Names are at least 3 characters'

/**
 * Returns a notice when the input is a 2LD whose label is too short to
 * register. The 3-character minimum is a .eth registrar rule, and subnames
 * have no minimum, so both are left alone.
 */
export const getSearchNotice = (value: string): string | null => {
  const [label = '', ...rest] = value.trim().toLowerCase().split('.')
  if (rest.length > 1) return null
  if (rest[0] !== undefined && !'eth'.startsWith(rest[0])) return null

  const length = [...label].length
  return length > 0 && length < 3 ? SHORT_LABEL_NOTICE : null
}

/**
 * Pure function to build search suggestions from user input
 * Handles both Ethereum addresses and ENS names
 *
 * @param options - Configuration object
 * @returns Array of suggestions to display
 */
export const buildSearchSuggestions = ({
  value,
  isMobile,
  navigateToAddress,
  navigateToName,
  navigateToResolver,
  isResolver,
  validTlds,
}: BuildSuggestionsOptions): Suggestion[] => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return []

  const items: Suggestion[] = []

  // Check if input is a valid Ethereum address
  if (isAddress(trimmedValue, { strict: false })) {
    try {
      const checksum = checksumAddress(trimmedValue as Address)

      if (isResolver && navigateToResolver) {
        items.push({
          id: `resolver:${checksum}`,
          label: isMobile ? truncateAddress(checksum) : checksum,
          description: 'View resolver details',
          inputValue: checksum,
          action: () => navigateToResolver(checksum),
        })
      } else {
        items.push({
          id: `address:${checksum}`,
          label: isMobile ? truncateAddress(checksum) : checksum,
          description: 'View address details',
          inputValue: checksum,
          action: () => navigateToAddress(checksum),
        })
      }

      return items
    } catch {
      return []
    }
  }

  // Input is NOT a valid address, treat it as an ENS name
  const lowercaseValue = trimmedValue.toLowerCase()
  const dotCount = lowercaseValue.split('.').length - 1
  const firstDotIndex = lowercaseValue.indexOf('.')
  const afterFirstDot =
    firstDotIndex >= 0 ? lowercaseValue.slice(firstDotIndex + 1) : ''
  const labelBeforeFirstDot =
    firstDotIndex >= 0 ? lowercaseValue.slice(0, firstDotIndex) : lowercaseValue

  const createNameSuggestion = (name: string): Suggestion => {
    const displayLabel = isMobile ? truncateAddress(name, 18, 8) : name
    return {
      id: `name:${name}`,
      label: displayLabel,
      description: 'View ENS name details',
      inputValue: name,
      action: () => navigateToName(name),
    }
  }

  const isTldPrefix = (s: string) =>
    s === '' || (validTlds ?? []).some((t) => t.startsWith(s))

  // Subname: 2+ dots (e.g. "test.florin.eth") or 1 dot where the suffix
  // isn't a TLD prefix (e.g. "test.florin" — "florin" doesn't match any TLD).
  const isSubname =
    dotCount >= 2 ||
    (dotCount === 1 && afterFirstDot !== '' && !isTldPrefix(afterFirstDot))

  if (!isSubname && [...labelBeforeFirstDot].length < 3) return []

  if (isSubname) {
    const lastDotIndex = lowercaseValue.lastIndexOf('.')
    const afterLastDot = lowercaseValue.slice(lastDotIndex + 1)
    const beforeLastDot = lowercaseValue.slice(0, lastDotIndex)

    const endsWithKnownTld = (validTlds ?? ['eth']).includes(afterLastDot)

    if (endsWithKnownTld) {
      if (isValidEnsName(lowercaseValue)) {
        items.push(createNameSuggestion(lowercaseValue))
      }
      return items
    }

    // Part after last dot is a partial TLD (e.g. "test.florin.e" → "eth")
    if (dotCount >= 2 && isTldPrefix(afterLastDot)) {
      const matchingTlds =
        afterLastDot === ''
          ? [...(validTlds ?? ['eth'])]
          : (validTlds ?? ['eth']).filter((t) => t.startsWith(afterLastDot))
      for (const tld of matchingTlds) {
        const name = `${beforeLastDot}.${tld}`
        if (isValidEnsName(name)) {
          items.push(createNameSuggestion(name))
        }
      }
      return items
    }

    // Suffix doesn't look like a TLD — suggest as-is and with .eth appended
    if (isValidEnsName(lowercaseValue)) {
      items.push(createNameSuggestion(lowercaseValue))
    }
    const withEth = `${lowercaseValue}.eth`
    if (isValidEnsName(withEth)) {
      items.push(createNameSuggestion(withEth))
    }
    return items
  }

  // Multi-TLD mode for single labels (0 dots) or label + partial TLD (1 dot).
  if (validTlds?.length && labelBeforeFirstDot.length > 0) {
    const tldsToSuggest =
      afterFirstDot === ''
        ? [...validTlds]
        : [
            'eth',
            ...validTlds.filter(
              (t) => t !== 'eth' && t.startsWith(afterFirstDot),
            ),
          ]
    for (const tld of tldsToSuggest) {
      const name = `${labelBeforeFirstDot}.${tld}`
      if (isValidEnsName(name)) {
        items.push(createNameSuggestion(name))
      }
    }
    return items
  }

  // Fallback (no validTlds): suggest as-is if valid, plus .eth version
  if (isValidEnsName(lowercaseValue)) {
    items.push(createNameSuggestion(lowercaseValue))
  }
  if (!lowercaseValue.endsWith('.eth')) {
    const valueWithEthSuffix = ensureEthSuffix(lowercaseValue)
    if (
      valueWithEthSuffix !== lowercaseValue &&
      isValidEnsName(valueWithEthSuffix)
    ) {
      items.push(createNameSuggestion(valueWithEthSuffix))
    }
  }

  return items
}
