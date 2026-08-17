import { registryRoles } from '@ensdomains/ensjs/utils/v2'
import { describe, expect, it } from 'vitest'
import { filterEventsByResource } from './filterEventsByResource'

const RESOURCE_A =
  '0x00000000000000000000000000000000000000000000000000000000000000aa'
const RESOURCE_B =
  '0x00000000000000000000000000000000000000000000000000000000000000bb'
const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678'
const TX_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const

const makeEvent = (
  overrides: {
    resource?: string
    account?: string
    oldRoleBitmap?: string
    newRoleBitmap?: string
    blockNumber?: number
    timestamp?: number
  } = {},
) => ({
  type: 'EACRolesChanged',
  data: JSON.stringify({
    resource: overrides.resource ?? RESOURCE_A,
    account: overrides.account ?? ACCOUNT,
    oldRoleBitmap: overrides.oldRoleBitmap ?? '0x0',
    newRoleBitmap:
      overrides.newRoleBitmap ?? `0x${registryRoles.ROLE_RENEW.toString(16)}`,
  }),
  transactionHash: TX_HASH,
  timestamp: overrides.timestamp ?? 1000,
  blockNumber: overrides.blockNumber ?? 100,
})

describe('filterEventsByResource', () => {
  it('should return matching events for a resource', () => {
    const events = [makeEvent()]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('0x1234567890AbcdEF1234567890aBcdef12345678')
    expect(result[0].newRoles).toContain('ROLE_RENEW')
    expect(result[0].oldRoles).toEqual([])
  })

  it('should filter out events for other resources', () => {
    const events = [
      makeEvent({ resource: RESOURCE_A }),
      makeEvent({ resource: RESOURCE_B }),
    ]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result).toHaveLength(1)
  })

  it('should return all events when resource is not provided', () => {
    const events = [
      makeEvent({ resource: RESOURCE_A }),
      makeEvent({ resource: RESOURCE_B }),
    ]
    const result = filterEventsByResource(events)

    expect(result).toHaveLength(2)
  })

  it('should compare resources case-insensitively', () => {
    const events = [makeEvent({ resource: RESOURCE_A.toUpperCase() })]
    const result = filterEventsByResource(events, RESOURCE_A.toLowerCase())

    expect(result).toHaveLength(1)
  })

  it('should match ROOT_RESOURCE regardless of zero-padding', () => {
    // Indexer emits the root resource as "0x0"; callers filter with the
    // 32-byte-padded zero. They're the same uint256 and must match.
    const paddedRoot = `0x${'0'.repeat(64)}`
    const events = [makeEvent({ resource: '0x0' })]
    const result = filterEventsByResource(events, paddedRoot)

    expect(result).toHaveLength(1)
  })

  it('should sort by most recent block first', () => {
    const events = [
      makeEvent({ blockNumber: 50 }),
      makeEvent({ blockNumber: 200 }),
      makeEvent({ blockNumber: 100 }),
    ]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result.map((e) => e.blockNumber)).toEqual([200, 100, 50])
  })

  it('should skip events with no data', () => {
    const events = [
      {
        type: 'EACRolesChanged',
        data: '',
        transactionHash: TX_HASH,
        timestamp: 1000,
        blockNumber: 100,
      },
      makeEvent(),
    ]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result).toHaveLength(1)
  })

  it('should skip events with missing resource or account', () => {
    const events = [
      {
        type: 'EACRolesChanged',
        data: JSON.stringify({ oldRoleBitmap: '0x0', newRoleBitmap: '0x0' }),
        transactionHash: TX_HASH,
        timestamp: 1000,
        blockNumber: 100,
      },
    ]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result).toHaveLength(0)
  })

  it('should decode old and new role bitmaps', () => {
    const oldBitmap = registryRoles.ROLE_RENEW
    const newBitmap = registryRoles.ROLE_RENEW | registryRoles.ROLE_UNREGISTER

    const events = [
      makeEvent({
        oldRoleBitmap: `0x${oldBitmap.toString(16)}`,
        newRoleBitmap: `0x${newBitmap.toString(16)}`,
      }),
    ]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result[0].oldRoles).toContain('ROLE_RENEW')
    expect(result[0].oldRoles).not.toContain('ROLE_UNREGISTER')
    expect(result[0].newRoles).toContain('ROLE_RENEW')
    expect(result[0].newRoles).toContain('ROLE_UNREGISTER')
  })

  it('should return empty array when no events match', () => {
    const events = [makeEvent({ resource: RESOURCE_B })]
    const result = filterEventsByResource(events, RESOURCE_A)

    expect(result).toEqual([])
  })
})
