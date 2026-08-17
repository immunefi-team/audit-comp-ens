import { getCoderByCoinName } from '@ensdomains/address-encoder'
import {
  getProtocolType,
  isValidContentHash as isValidEncodedContentHash,
} from '@ensdomains/ensjs/utils'
import { getAddress } from 'viem'
import type { EditableRecord } from './editRecordUtils'

export interface ValidationError {
  recordId: string
  message: string
}

/** Text record keys that should contain valid URLs */
const URL_KEYS = new Set(['avatar', 'url', 'banner', 'header', 'cover'])

/** Text record keys that should contain valid email addresses */
const EMAIL_KEYS = new Set(['email'])

/**
 * Validates a URL string.
 * Accepts http://, https://, ipfs://, and ipns:// protocols.
 */
function isValidUrl(value: string): boolean {
  if (!value) return true // Empty is valid (means deletion)

  try {
    const url = new URL(value)
    return ['http:', 'https:', 'ipfs:', 'ipns:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Validates an email address using a simple regex.
 */
function isValidEmail(value: string): boolean {
  if (!value) return true // Empty is valid (means deletion)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Normalizes an ETH address to checksum format if possible.
 */
function normalizeCoinAddress(coin: string, address: string): string {
  if (coin.toLowerCase() === 'eth') {
    try {
      return getAddress(address)
    } catch {
      return address
    }
  }
  return address
}

/**
 * Validates a cryptocurrency address using the address-encoder library.
 * Returns an error message if invalid, or null if valid.
 */
function validateCryptoAddress(coin: string, address: string): string | null {
  if (!address) return null // Empty is valid (means deletion)

  try {
    const normalizedAddress = normalizeCoinAddress(coin, address)
    const coder = getCoderByCoinName(coin.toLowerCase())
    coder.decode(normalizedAddress)
    return null // Valid
  } catch (e: unknown) {
    // Extract error message
    if (typeof e === 'string') return e
    if (e instanceof Error) {
      // Clean up common error messages
      if (e.message.includes('Invalid checksum'))
        return 'Invalid address checksum'
      if (e.message.includes('Invalid address')) return 'Invalid address format'
      return e.message
    }
    return 'Invalid address format'
  }
}

/**
 * Validates a contentHash value per ENSIP-7.
 * Uses ensjs's getProtocolType for protocol validation, which supports:
 * ipfs://, ipns://, bzz://, onion://, onion3://, sia://, ar://, arweave://,
 * and /ipfs/..., /ipns/... path formats.
 * Also accepts raw hex (0x...).
 */
function isValidContentHash(value: string): boolean {
  if (!value) return true // Empty is valid (means deletion)

  // Validate raw hex via ensjs (checks for valid multicodec prefix, not just any hex)
  if (value.startsWith('0x')) {
    try {
      return isValidEncodedContentHash(value)
    } catch {
      return false
    }
  }

  // Use ensjs's protocol matching (supports all ENSIP-7 protocols)
  const result = getProtocolType(value)
  return result !== null && result.decoded.length > 0
}

/**
 * Validates an ABI value - must be a valid JSON array.
 * Returns a specific error message if invalid, or null if valid.
 */
function validateAbi(value: string): string | null {
  if (!value) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return 'Invalid JSON format. ABI must be a valid JSON array.'
  }

  if (!Array.isArray(parsed)) {
    return 'ABI must be a JSON array (starting with [ and ending with ]).'
  }

  return null
}

/**
 * Validates a single record and returns an error message if invalid.
 *
 * @param record - The record to validate
 * @returns An error message if invalid, null if valid
 */
export function validateRecord(record: EditableRecord): string | null {
  const { type, value } = record

  // Skip validation for deleted records
  if (record.isDeleted) return null

  // Empty values are always valid (they represent deletion)
  if (!value || value.trim() === '') return null

  if (type === 'text') {
    const key = record.key.toLowerCase()

    // URL validation
    if (URL_KEYS.has(key)) {
      if (!isValidUrl(value)) {
        return `Invalid URL format. Must start with http://, https://, ipfs://, or ipns://`
      }
    }

    // Email validation
    if (EMAIL_KEYS.has(key)) {
      if (!isValidEmail(value)) {
        return 'Invalid email address format'
      }
    }
  }

  if (type === 'address') {
    // Validate all cryptocurrency addresses using address-encoder
    const coin = record.key || 'eth'
    const error = validateCryptoAddress(coin, value)
    if (error) {
      return `Invalid ${coin.toUpperCase()} address: ${error}`
    }
  }

  if (type === 'contentHash') {
    if (!isValidContentHash(value)) {
      return 'Invalid content hash. Supported protocols: ipfs://, ipns://, bzz://, onion://, onion3://, sia://, ar://'
    }
  }

  if (type === 'abi') {
    const abiError = validateAbi(value)
    if (abiError) return abiError
  }

  return null
}

/**
 * Validates all records and returns an array of validation errors.
 *
 * @param records - The records to validate
 * @returns Array of validation errors (empty if all valid)
 */
export function validateRecords(records: EditableRecord[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (const record of records) {
    // Only validate edited or new records
    if (!record.isEdited && !record.isNew) continue

    const error = validateRecord(record)
    if (error) {
      // Include _uid in recordId for new records to ensure uniqueness
      const uid = record._uid ? `-${record._uid}` : ''
      const recordId =
        record.type === 'contentHash'
          ? `contentHash${uid}`
          : record.type === 'abi'
            ? `abi${uid}`
            : record.type === 'address'
              ? `address-${record.key}${uid}`
              : `text-${record.key}${uid}`

      errors.push({ recordId, message: error })
    }
  }

  return errors
}

/**
 * Gets a validation error for a specific record by ID.
 *
 * @param errors - Array of validation errors
 * @param recordId - The record ID to find
 * @returns The error message or undefined if no error
 */
export function getRecordError(
  errors: ValidationError[],
  recordId: string,
): string | undefined {
  return errors.find((e) => e.recordId === recordId)?.message
}
