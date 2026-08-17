import {
  getProtocolType,
  isValidContentHash as isValidEncodedContentHash,
} from '@ensdomains/ensjs/utils'

/**
 * Validates a content hash value per ENSIP-7.
 *
 * @returns Error message string if invalid, undefined if valid
 */
export const validateContentHash = (
  value: string | undefined,
): string | undefined => {
  if (!value || value.trim() === '') return undefined

  const trimmed = value.trim()

  // Validate raw hex content hash via ensjs (checks for valid multicodec prefix)
  if (trimmed.startsWith('0x')) {
    try {
      if (!isValidEncodedContentHash(trimmed)) {
        return 'Invalid encoded content hash'
      }
    } catch {
      return 'Invalid encoded content hash'
    }
    return undefined
  }

  // Use ensjs's protocol matching (supports all ENSIP-7 protocols)
  const protocolType = getProtocolType(trimmed)

  if (!protocolType) {
    return 'Enter a valid content hash (e.g. ipfs://..., ipns://..., bzz://..., ar://...)'
  }

  if (!protocolType.decoded) {
    return 'Missing identifier after protocol'
  }

  return undefined
}
