import { type Address, decodeErrorResult, type Hex, parseAbi } from 'viem'
import {
  LIB_MIGRATION_ERRORS_ABI,
  MIGRATION_HELPER_ABI,
} from '../contracts/abis'
import { ProfileFetchError } from './fetchV1Profiles'

export type MigrationError =
  | { type: 'generic'; message: string }
  | { type: 'plan-changed' }
  | { type: 'retry-blocked' }
  | { type: 'cleanup-failed' }
  | {
      type: 'profile-fetch-failed'
      phase: 'subgraph' | 'onchain'
      message: string
    }
  | { type: 'user-rejected' }
  | { type: 'preflight-timeout'; message: string; timeoutMs?: number }
  | { type: 'permission-missing'; tokenId?: bigint }
  | { type: 'token-owner-changed'; tokenId?: bigint }
  | { type: 'hca-owner-mismatch' }
  | { type: 'direct-transfer-unauthorized'; caller: Address }
  | { type: 'name-not-locked'; tokenId: bigint }
  | { type: 'name-is-locked'; tokenId: bigint }
  | { type: 'name-data-mismatch'; tokenId: bigint }
  | { type: 'frozen-token-approval'; tokenId: bigint }
  | { type: 'invalid-data' }
  | { type: 'name-requires-migration' }

export const extractErrorMessage = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err)

  let deepest = err
  while ('cause' in deepest && deepest.cause instanceof Error) {
    deepest = deepest.cause
  }

  const short =
    (err as unknown as Record<string, unknown>).shortMessage ??
    (deepest as unknown as Record<string, unknown>).shortMessage

  if (typeof short === 'string') return short
  if (deepest !== err && deepest.message) return deepest.message

  return err.message || 'Migration failed'
}

const walkCauseChain = (err: unknown): Error[] => {
  const chain: Error[] = []
  let cur: unknown = err
  while (cur instanceof Error) {
    chain.push(cur)
    cur = (cur as { cause?: unknown }).cause
  }
  return chain
}

const isUserRejection = (err: unknown): boolean => {
  if (err instanceof Error && err.name === 'MigrationUserRejectedError') {
    return true
  }
  return walkCauseChain(err).some(
    (e) =>
      e.name === 'UserRejectedRequestError' || /user rejected/i.test(e.message),
  )
}

const findTimeoutError = (
  err: unknown,
): (Error & { timeoutMs?: number }) | null => {
  for (const e of walkCauseChain(err)) {
    if (e.name === 'PreflightTimeoutError') {
      return e as Error & { timeoutMs?: number }
    }
  }
  return null
}

const hasNamedError = (err: unknown, name: string): boolean =>
  walkCauseChain(err).some((error) => error.name === name)

const asHexData = (value: unknown): Hex | null =>
  typeof value === 'string' && value.startsWith('0x') ? (value as Hex) : null

const findRevertData = (err: unknown): readonly Hex[] => {
  const matches = walkCauseChain(err).flatMap((error) => {
    const errorRecord = error as unknown as Record<string, unknown>
    const nestedData = errorRecord.data
    const nestedDataRecord =
      typeof nestedData === 'object' && nestedData !== null
        ? (nestedData as Record<string, unknown>)
        : null
    return [
      asHexData(errorRecord.raw),
      asHexData(nestedData),
      asHexData(nestedDataRecord?.data),
    ].filter((data): data is Hex => data !== null)
  })
  return [...new Set(matches)]
}

const MIGRATION_EXECUTION_ERRORS_ABI = [
  ...MIGRATION_HELPER_ABI,
  ...parseAbi([
    'error CallerNotOwner()',
    'error UnauthorizedCaller(address caller)',
    'error ERC721InsufficientApproval(address operator, uint256 tokenId)',
    'error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)',
    'error ERC1155MissingApprovalForAll(address operator, address owner)',
    'error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)',
    'error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength)',
  ]),
] as const

const tryDecodeMigrationExecutionError = (data: Hex): MigrationError | null => {
  try {
    const decoded = decodeErrorResult({
      abi: MIGRATION_EXECUTION_ERRORS_ABI,
      data,
    })
    switch (decoded.errorName) {
      case 'CallerNotOwner':
        return { type: 'hca-owner-mismatch' }
      case 'UnauthorizedCaller':
        return {
          type: 'direct-transfer-unauthorized',
          caller: decoded.args[0] as Address,
        }
      case 'NotApprovedOperator':
        return { type: 'permission-missing' }
      case 'WrappedOwnerMismatch':
        return {
          type: 'token-owner-changed',
          tokenId: decoded.args[0] as bigint,
        }
      case 'ParentNotMigrated':
        return {
          type: 'generic',
          message: 'A parent name must migrate before its child names.',
        }
      case 'ERC721InsufficientApproval':
        return {
          type: 'permission-missing',
          tokenId: decoded.args[1] as bigint,
        }
      case 'ERC1155MissingApprovalForAll':
        return { type: 'permission-missing' }
      case 'ERC721IncorrectOwner':
        return {
          type: 'token-owner-changed',
          tokenId: decoded.args[1] as bigint,
        }
      case 'ERC1155InsufficientBalance':
        return {
          type: 'token-owner-changed',
          tokenId: decoded.args[3] as bigint,
        }
      case 'ERC1155InvalidArrayLength':
        return { type: 'invalid-data' }
    }
  } catch {
    // not a helper/HCA/token/receiver error
  }
  return null
}

const ERROR_STRING_SELECTOR = '0x08c379a0'
const WRAPPED_ERROR_PREFIX = 'WrappedError::0x'
const MAX_REVERT_UNWRAP_DEPTH = 8

const matchLibMigrationError = (data: Hex): MigrationError | null => {
  try {
    const decoded = decodeErrorResult({ abi: LIB_MIGRATION_ERRORS_ABI, data })
    switch (decoded.errorName) {
      case 'NameNotLocked':
        return { type: 'name-not-locked', tokenId: decoded.args[0] as bigint }
      case 'NameIsLocked':
        return { type: 'name-is-locked', tokenId: decoded.args[0] as bigint }
      case 'NameDataMismatch':
        return {
          type: 'name-data-mismatch',
          tokenId: decoded.args[0] as bigint,
        }
      case 'FrozenTokenApproval':
        return {
          type: 'frozen-token-approval',
          tokenId: decoded.args[0] as bigint,
        }
      case 'InvalidData':
        return { type: 'invalid-data' }
      case 'NameRequiresMigration':
        return { type: 'name-requires-migration' }
    }
  } catch {
    // not a recognized LibMigration error
  }
  return null
}

const decodeErrorStringPayload = (data: Hex): Hex | null => {
  if (!data.toLowerCase().startsWith(ERROR_STRING_SELECTOR)) return null

  try {
    const argsStart = 2 + 8
    const offsetEnd = argsStart + 64
    const offset = Number.parseInt(data.slice(argsStart, offsetEnd), 16)
    const lengthStart = argsStart + offset * 2
    const payloadStart = lengthStart + 64
    const length = Number.parseInt(data.slice(lengthStart, payloadStart), 16)
    const payloadEnd = payloadStart + length * 2

    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 0 ||
      payloadEnd > data.length
    ) {
      return null
    }

    return `0x${data.slice(payloadStart, payloadEnd)}` as Hex
  } catch {
    return null
  }
}

const hexBytesToAscii = (data: Hex): string => {
  let result = ''
  for (let i = 2; i < data.length; i += 2) {
    result += String.fromCharCode(Number.parseInt(data.slice(i, i + 2), 16))
  }
  return result
}

const parseHexText = (value: string): Hex | null => {
  const unprefixed = value.startsWith('0x') ? value.slice(2) : value
  if (unprefixed.length < 8 || unprefixed.length % 2 !== 0) return null
  if (!/^[0-9a-f]+$/i.test(unprefixed)) return null
  return `0x${unprefixed}` as Hex
}

const getNestedRevertData = (data: Hex): readonly Hex[] => {
  const payload = decodeErrorStringPayload(data)
  if (!payload) return []

  const text = hexBytesToAscii(payload)
  if (text.startsWith(WRAPPED_ERROR_PREFIX)) {
    const wrapped = parseHexText(text.slice(WRAPPED_ERROR_PREFIX.length))
    return wrapped ? [wrapped] : []
  }

  const encodedAsText = parseHexText(text)
  return encodedAsText ? [encodedAsText] : [payload]
}

const matchDirectTransferErrorString = (data: Hex): MigrationError | null => {
  const payload = decodeErrorStringPayload(data)
  if (!payload) return null
  const message = hexBytesToAscii(payload)

  if (
    /not owner nor approved|not token owner or approved|missing approval for all/i.test(
      message,
    )
  ) {
    return { type: 'permission-missing' }
  }
  if (
    /incorrect owner|transfer of token that is not own|insufficient balance|nonexistent token/i.test(
      message,
    )
  ) {
    return { type: 'token-owner-changed' }
  }
  return null
}

const matchMigrationRevert = (data: Hex, depth = 0): MigrationError | null => {
  if (depth >= MAX_REVERT_UNWRAP_DEPTH) return null

  const directMatch =
    tryDecodeMigrationExecutionError(data) ??
    matchLibMigrationError(data) ??
    matchDirectTransferErrorString(data)
  if (directMatch) return directMatch

  for (const inner of getNestedRevertData(data)) {
    const nestedMatch = matchMigrationRevert(inner, depth + 1)
    if (nestedMatch) return nestedMatch
  }

  return null
}

export const decodeMigrationError = (err: unknown): MigrationError => {
  if (isUserRejection(err)) return { type: 'user-rejected' }

  if (hasNamedError(err, 'MigrationPlanChangedError')) {
    return { type: 'plan-changed' }
  }
  if (hasNamedError(err, 'MigrationCleanupError')) {
    return { type: 'cleanup-failed' }
  }
  if (
    [
      'SubmittedAtomicMigrationIndeterminateError',
      'SubmittedAtomicMigrationVerificationError',
      'AtomicMigrationIntentIndeterminateError',
      'MigrationSourceOwnershipError',
      'MigrationBatchJournalCorruptError',
      'MigrationBatchJournalUnavailableError',
    ].some((name) => hasNamedError(err, name))
  ) {
    return { type: 'retry-blocked' }
  }

  const timeout = findTimeoutError(err)
  if (timeout) {
    return {
      type: 'preflight-timeout',
      message: extractErrorMessage(timeout),
      timeoutMs: timeout.timeoutMs,
    }
  }

  if (err instanceof ProfileFetchError) {
    return {
      type: 'profile-fetch-failed',
      phase: err.phase,
      message: extractErrorMessage(err),
    }
  }

  for (const revertData of findRevertData(err)) {
    const match = matchMigrationRevert(revertData)
    if (match) return match
  }

  return { type: 'generic', message: extractErrorMessage(err) }
}
