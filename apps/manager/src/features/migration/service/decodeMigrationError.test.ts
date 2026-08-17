import { encodeErrorResult, type Hex, parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'
import { LIB_MIGRATION_ERRORS_ABI } from '../contracts/abis'
import {
  decodeMigrationError,
  extractErrorMessage,
} from './decodeMigrationError'
import { ProfileFetchError } from './fetchV1Profiles'

const revertWith = (data: Hex) =>
  Object.assign(new Error('reverted'), {
    name: 'ContractFunctionRevertedError',
    data,
  })

const directMigrationErrorsAbi = parseAbi([
  'error CallerNotOwner()',
  'error UnauthorizedCaller(address caller)',
  'error NotApprovedOperator(address nft, address owner)',
  'error WrappedOwnerMismatch(uint256 tokenId)',
  'error ParentNotMigrated(bytes name)',
  'error ERC721InsufficientApproval(address operator, uint256 tokenId)',
  'error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)',
  'error ERC1155MissingApprovalForAll(address operator, address owner)',
])

const errorStringAbi = [
  { type: 'error', name: 'Error', inputs: [{ type: 'string' }] },
] as const

describe('extractErrorMessage', () => {
  it.each([
    ['plain string', 'plain string'],
    [42, '42'],
    [null, 'null'],
    [undefined, 'undefined'],
    [new Error('boom'), 'boom'],
    [new Error(''), 'Migration failed'],
  ])('%s → %s', (input, expected) => {
    expect(extractErrorMessage(input)).toBe(expected)
  })

  it('prefers shortMessage on the outer error', () => {
    const err = Object.assign(new Error('long'), { shortMessage: 'short' })
    expect(extractErrorMessage(err)).toBe('short')
  })

  it('prefers shortMessage on the deepest cause', () => {
    const deepest = Object.assign(new Error('deep long'), {
      shortMessage: 'deep short',
    })
    const outer = new Error('outer', {
      cause: new Error('middle', { cause: deepest }),
    })
    expect(extractErrorMessage(outer)).toBe('deep short')
  })

  it('unwraps to the deepest cause message when no shortMessage exists', () => {
    const outer = new Error('outer', {
      cause: new Error('middle', { cause: new Error('root cause') }),
    })
    expect(extractErrorMessage(outer)).toBe('root cause')
  })

  it('stops unwrapping at a non-Error cause', () => {
    const outer = new Error('outer')
    ;(outer as Error & { cause: unknown }).cause = { not: 'an error' }
    expect(extractErrorMessage(outer)).toBe('outer')
  })
})

describe('decodeMigrationError — direct mappings', () => {
  it('maps permission-plan drift to a refreshable error', () => {
    const planChanged = Object.assign(new Error('preview is stale'), {
      name: 'MigrationPlanChangedError',
    })
    const outer = new Error('migration failed', { cause: planChanged })

    expect(decodeMigrationError(outer)).toEqual({ type: 'plan-changed' })
  })

  it('maps an uncertain submitted batch to a fail-closed retry error', () => {
    const uncertain = Object.assign(new Error('receipt unavailable'), {
      name: 'SubmittedAtomicMigrationIndeterminateError',
    })

    expect(decodeMigrationError(uncertain)).toEqual({
      type: 'retry-blocked',
    })
  })

  it('maps cleanup failure to its dedicated recovery state', () => {
    const cleanup = Object.assign(new Error('cleanup rejected'), {
      name: 'MigrationCleanupError',
    })

    expect(decodeMigrationError(cleanup)).toEqual({
      type: 'cleanup-failed',
    })
  })

  it.each([
    [
      'ProfileFetchError subgraph',
      new ProfileFetchError({
        cause: new Error('subgraph 500'),
        phase: 'subgraph',
      }),
      {
        type: 'profile-fetch-failed',
        phase: 'subgraph',
        message: 'subgraph 500',
      },
    ],
    [
      'ProfileFetchError onchain',
      new ProfileFetchError({
        cause: new Error('rpc timeout'),
        phase: 'onchain',
      }),
      {
        type: 'profile-fetch-failed',
        phase: 'onchain',
        message: 'rpc timeout',
      },
    ],
    [
      'unknown Error → generic',
      new Error('surprise'),
      {
        type: 'generic',
        message: 'surprise',
      },
    ],
    [
      'non-Error → generic',
      'string error',
      {
        type: 'generic',
        message: 'string error',
      },
    ],
    [
      'viem-shaped error uses shortMessage',
      Object.assign(new Error('long viem message'), {
        shortMessage: 'User rejected the request.',
      }),
      { type: 'generic', message: 'User rejected the request.' },
    ],
  ] as const)('%s', (_, err, expected) => {
    expect(decodeMigrationError(err)).toEqual(expected)
  })
})

describe('decodeMigrationError — user rejection', () => {
  it('maps UserRejectedRequestError by .name', () => {
    const err = Object.assign(new Error('denied'), {
      name: 'UserRejectedRequestError',
    })
    expect(decodeMigrationError(err)).toEqual({ type: 'user-rejected' })
  })

  it('maps a rejection wrapped in a cause chain', () => {
    const rejection = Object.assign(new Error('Request rejected'), {
      name: 'UserRejectedRequestError',
    })
    const outer = new Error('outer', {
      cause: new Error('middle', { cause: rejection }),
    })
    expect(decodeMigrationError(outer)).toEqual({ type: 'user-rejected' })
  })

  it('maps errors whose message contains "user rejected"', () => {
    expect(
      decodeMigrationError(new Error('MetaMask Tx Signature: user rejected')),
    ).toEqual({ type: 'user-rejected' })
  })
})

describe('decodeMigrationError — preflight timeout', () => {
  const preflightTimeout = (message: string, timeoutMs: number) =>
    Object.assign(new Error(message), {
      name: 'PreflightTimeoutError',
      timeoutMs,
    })

  it('maps PreflightTimeoutError to preflight-timeout with timeoutMs', () => {
    const err = preflightTimeout(
      'Pre-flight RPC call timed out after 15000ms',
      15000,
    )
    expect(decodeMigrationError(err)).toEqual({
      type: 'preflight-timeout',
      message: 'Pre-flight RPC call timed out after 15000ms',
      timeoutMs: 15000,
    })
  })

  it('finds PreflightTimeoutError wrapped deep in a cause chain', () => {
    const outer = new Error('preflight failed', {
      cause: preflightTimeout('timed out', 5000),
    })
    expect(decodeMigrationError(outer)).toEqual({
      type: 'preflight-timeout',
      message: 'timed out',
      timeoutMs: 5000,
    })
  })

  it('user-rejection takes precedence over preflight-timeout', () => {
    const rejection = Object.assign(new Error('user rejected'), {
      name: 'UserRejectedRequestError',
      cause: preflightTimeout('timed out', 5000),
    })
    expect(decodeMigrationError(rejection)).toEqual({ type: 'user-rejected' })
  })
})

describe('decodeMigrationError — helper, HCA, and token reverts', () => {
  it('maps an HCA owner mismatch', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'CallerNotOwner',
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'hca-owner-mismatch',
    })
  })

  it('maps a missing ERC-721 token approval', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ERC721InsufficientApproval',
      args: ['0x1111111111111111111111111111111111111111', 42n],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'permission-missing',
      tokenId: 42n,
    })
  })

  it('maps a missing NameWrapper operator approval', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ERC1155MissingApprovalForAll',
      args: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'permission-missing',
    })
  })

  it('maps a MigrationHelper operator approval mismatch', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'NotApprovedOperator',
      args: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'permission-missing',
    })
  })

  it('maps a MigrationHelper wrapped-owner mismatch', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'WrappedOwnerMismatch',
      args: [44n],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'token-owner-changed',
      tokenId: 44n,
    })
  })

  it('explains a MigrationHelper parent-ordering failure', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ParentNotMigrated',
      args: ['0x06706172656e740365746800'],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'generic',
      message: 'A parent name must migrate before its child names.',
    })
  })

  it('maps an ownership change after preflight', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ERC721IncorrectOwner',
      args: [
        '0x1111111111111111111111111111111111111111',
        43n,
        '0x2222222222222222222222222222222222222222',
      ],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'token-owner-changed',
      tokenId: 43n,
    })
  })

  it('maps a direct receiver caller mismatch', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'UnauthorizedCaller',
      args: ['0x1111111111111111111111111111111111111111'],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'direct-transfer-unauthorized',
      caller: '0x1111111111111111111111111111111111111111',
    })
  })
})

describe('decodeMigrationError — wrapped LibMigration errors', () => {
  // Legacy fixtures encoded the original revert as a plain "0x..." string.
  const wrap = (inner: Hex): Hex =>
    encodeErrorResult({
      abi: errorStringAbi,
      errorName: 'Error',
      args: [inner],
    })

  // The deployed contracts-v2 WrappedErrorLib uses this detectable prefix
  // before the hex-encoded typed revert.
  const wrapDeployed = (inner: Hex): Hex =>
    encodeErrorResult({
      abi: errorStringAbi,
      errorName: 'Error',
      args: [`WrappedError::0x${inner.slice(2)}`],
    })

  it('unwraps NameNotLocked', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameNotLocked',
      args: [7n],
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'name-not-locked',
      tokenId: 7n,
    })
  })

  it('unwraps the deployed WrappedErrorLib prefix', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameDataMismatch',
      args: [8n],
    })
    expect(decodeMigrationError(revertWith(wrapDeployed(inner)))).toEqual({
      type: 'name-data-mismatch',
      tokenId: 8n,
    })
  })

  it('checks deeper client errors when executeByOwner has outer revert data', () => {
    const inner = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ERC721InsufficientApproval',
      args: ['0x1111111111111111111111111111111111111111', 44n],
    })
    const controllerRevert = revertWith(inner)
    const hcaRevert = Object.assign(
      new Error('executeByOwner reverted', { cause: controllerRevert }),
      { data: '0xdeadbeef' as Hex },
    )

    expect(decodeMigrationError(hcaRevert)).toEqual({
      type: 'permission-missing',
      tokenId: 44n,
    })
  })

  it('reads viem ContractFunctionRevertedError raw data', () => {
    const raw = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'CallerNotOwner',
    })
    const error = Object.assign(new Error('executeByOwner reverted'), {
      data: { errorName: 'CallerNotOwner' },
      raw,
    })

    expect(decodeMigrationError(error)).toEqual({
      type: 'hca-owner-mismatch',
    })
  })

  it('reads nested raw RPC error data', () => {
    const data = encodeErrorResult({
      abi: directMigrationErrorsAbi,
      errorName: 'ERC1155MissingApprovalForAll',
      args: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
    })
    const error = Object.assign(new Error('execution reverted'), {
      data: { data },
    })

    expect(decodeMigrationError(error)).toEqual({
      type: 'permission-missing',
    })
  })

  it('recognizes legacy token permission errors wrapped as Error(string)', () => {
    const data = encodeErrorResult({
      abi: errorStringAbi,
      errorName: 'Error',
      args: ['ERC721: transfer caller is not owner nor approved'],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'permission-missing',
    })
  })

  it('recognizes legacy ownership errors wrapped as Error(string)', () => {
    const data = encodeErrorResult({
      abi: errorStringAbi,
      errorName: 'Error',
      args: ['ERC721: transfer of token that is not own'],
    })
    expect(decodeMigrationError(revertWith(data))).toEqual({
      type: 'token-owner-changed',
    })
  })

  it('unwraps FrozenTokenApproval', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'FrozenTokenApproval',
      args: [9n],
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'frozen-token-approval',
      tokenId: 9n,
    })
  })

  it('unwraps NameIsLocked', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameIsLocked',
      args: [11n],
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'name-is-locked',
      tokenId: 11n,
    })
  })

  it('unwraps NameDataMismatch', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameDataMismatch',
      args: [13n],
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'name-data-mismatch',
      tokenId: 13n,
    })
  })

  it('unwraps InvalidData (no args)', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'InvalidData',
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'invalid-data',
    })
  })

  it('unwraps NameRequiresMigration (no args)', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameRequiresMigration',
    })
    expect(decodeMigrationError(revertWith(wrap(inner)))).toEqual({
      type: 'name-requires-migration',
    })
  })

  it('falls through to generic when wrapped data is unrecognized', () => {
    const garbage = '0xdeadbeef' as Hex
    const result = decodeMigrationError(revertWith(wrap(garbage)))
    expect(result.type).toBe('generic')
  })
})

describe('decodeMigrationError — on-chain Error(string) raw-bytes wrap', () => {
  // Matches NameWrapper's actual rewrap: revert(string(abi.encodePacked(returnData)))
  // — the inner revert bytes are packed into the string payload verbatim.
  const wrapRaw = (inner: Hex): Hex => {
    const innerBytes = inner.slice(2)
    const length = innerBytes.length / 2
    const lengthHex = length.toString(16).padStart(64, '0')
    const paddedBytes = innerBytes.padEnd(
      Math.ceil(innerBytes.length / 64) * 64,
      '0',
    )
    return `0x08c379a00000000000000000000000000000000000000000000000000000000000000020${lengthHex}${paddedBytes}` as Hex
  }

  it('unwraps NameNotLocked from raw-bytes-as-string Error wrap', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameNotLocked',
      args: [42n],
    })
    expect(decodeMigrationError(revertWith(wrapRaw(inner)))).toEqual({
      type: 'name-not-locked',
      tokenId: 42n,
    })
  })

  it('unwraps FrozenTokenApproval from raw-bytes-as-string Error wrap', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'FrozenTokenApproval',
      args: [99n],
    })
    expect(decodeMigrationError(revertWith(wrapRaw(inner)))).toEqual({
      type: 'frozen-token-approval',
      tokenId: 99n,
    })
  })

  it('unwraps InvalidData (no args) from raw-bytes-as-string Error wrap', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'InvalidData',
    })
    expect(decodeMigrationError(revertWith(wrapRaw(inner)))).toEqual({
      type: 'invalid-data',
    })
  })

  it('unwraps NameRequiresMigration (no args) from raw-bytes-as-string Error wrap', () => {
    const inner = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameRequiresMigration',
    })
    expect(decodeMigrationError(revertWith(wrapRaw(inner)))).toEqual({
      type: 'name-requires-migration',
    })
  })

  it('recursively unwraps nested Error(string) data', () => {
    const typed = encodeErrorResult({
      abi: LIB_MIGRATION_ERRORS_ABI,
      errorName: 'NameIsLocked',
      args: [123n],
    })
    const controller = encodeErrorResult({
      abi: errorStringAbi,
      errorName: 'Error',
      args: [`WrappedError::0x${typed.slice(2)}`],
    })

    expect(decodeMigrationError(revertWith(wrapRaw(controller)))).toEqual({
      type: 'name-is-locked',
      tokenId: 123n,
    })
  })
})
