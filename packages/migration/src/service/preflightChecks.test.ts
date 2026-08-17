import { type Address, zeroAddress } from 'viem'
import { multicall } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fail,
  makeClassified,
  OTHER,
  OWNER,
  ok,
  publicClient,
} from './_fixtures'
import { FUSES } from './classifyNames'
import {
  checkFrozenApproval,
  checkOwnership,
  checkPremigrationReservation,
  runEligibilityChecks,
} from './preflightChecks'

vi.mock('viem/actions', () => ({
  multicall: vi.fn(),
}))

const multicallMock = vi.mocked(multicall)

beforeEach(() => {
  multicallMock.mockReset()
})

const futureWrapperExpiry = () => BigInt(Math.floor(Date.now() / 1000) + 3600)

describe('checkOwnership', () => {
  it('returns empty set for empty input', async () => {
    expect((await checkOwnership(publicClient, [], OWNER)).size).toBe(0)
    expect(multicallMock).not.toHaveBeenCalled()
  })

  it('marks unwrapped names whose ownerOf differs from migrationOwner', async () => {
    multicallMock.mockResolvedValueOnce([ok(OTHER), ok(OWNER)])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1' }), makeClassified({ id: '0xb1' })],
      OWNER,
    )
    expect([...ids]).toEqual(['0xa1'])
  })

  it('marks wrapped names by comparing NameWrapper.getData[0] to migrationOwner', async () => {
    const expiry = futureWrapperExpiry()
    multicallMock.mockResolvedValueOnce([
      ok([OWNER, 0, expiry] as const),
      ok([OTHER, 0, expiry] as const),
    ])
    const ids = await checkOwnership(
      publicClient,
      [
        makeClassified({ id: '0xa1', tokenType: 'locked-2ld' }),
        makeClassified({ id: '0xb1', tokenType: 'locked-2ld' }),
      ],
      OWNER,
    )
    expect([...ids]).toEqual(['0xb1'])
  })

  it('marks wrapped names whose on-chain wrapper expiry is in the past', async () => {
    multicallMock.mockResolvedValueOnce([ok([OWNER, 0, 100n] as const)])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1', tokenType: 'locked-2ld' })],
      OWNER,
    )
    expect([...ids]).toEqual(['0xa1'])
  })

  it('marks IS_DOT_ETH names in their grace period (owned but not transferable)', async () => {
    // Wrapper expiry is still in the future (registrarExpiry + 90d grace), so getData
    // reports the name as owned — but it is inside the grace period, so a transfer would
    // revert with "insufficient balance". Must be excluded despite the owner matching.
    const graceExpiry = BigInt(Math.floor(Date.now() / 1000) + 3600)
    multicallMock.mockResolvedValueOnce([
      ok([OWNER, Number(FUSES.IS_DOT_ETH), graceExpiry] as const),
    ])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1', tokenType: 'locked-2ld' })],
      OWNER,
    )
    expect([...ids]).toEqual(['0xa1'])
  })

  it('keeps IS_DOT_ETH names transferable when past the grace period start', async () => {
    // Wrapper expiry more than 90 days out → registration still live → transferable.
    const liveExpiry = BigInt(
      Math.floor(Date.now() / 1000) + 120 * 24 * 60 * 60,
    )
    multicallMock.mockResolvedValueOnce([
      ok([OWNER, Number(FUSES.IS_DOT_ETH), liveExpiry] as const),
    ])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1', tokenType: 'locked-2ld' })],
      OWNER,
    )
    expect(ids.size).toBe(0)
  })

  it('treats a failed multicall entry as already migrated', async () => {
    multicallMock.mockResolvedValueOnce([fail()])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1' })],
      OWNER,
    )
    expect([...ids]).toEqual(['0xa1'])
  })

  it('is case-insensitive on the owner comparison', async () => {
    multicallMock.mockResolvedValueOnce([
      ok(OWNER.toUpperCase() as unknown as Address),
    ])
    const ids = await checkOwnership(
      publicClient,
      [makeClassified({ id: '0xa1' })],
      OWNER,
    )
    expect(ids.size).toBe(0)
  })
})

describe('checkFrozenApproval', () => {
  it('returns empty set when no candidates', async () => {
    expect((await checkFrozenApproval(publicClient, [])).size).toBe(0)
  })

  it('marks candidates whose getApproved is non-zero', async () => {
    multicallMock.mockResolvedValueOnce([ok(OTHER), ok(zeroAddress)])
    const ids = await checkFrozenApproval(publicClient, [
      makeClassified({ id: '0xa1', tokenType: 'locked-2ld' }),
      makeClassified({ id: '0xb1', tokenType: 'locked-2ld' }),
    ])
    expect([...ids]).toEqual(['0xa1'])
  })

  it('fails closed: multicall failure is treated as frozen', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    multicallMock.mockResolvedValueOnce([fail()])
    const ids = await checkFrozenApproval(publicClient, [
      makeClassified({ id: '0xa1', tokenType: 'locked-2ld' }),
    ])
    expect([...ids]).toEqual(['0xa1'])
    warn.mockRestore()
  })
})

describe('checkPremigrationReservation', () => {
  it('marks 2LDs that are not RESERVED and ignores child registries', async () => {
    multicallMock.mockResolvedValueOnce([ok(1), ok(0)])
    const reserved = makeClassified({ id: '0xa1', labelhash: '0xa1' })
    const available = makeClassified({ id: '0xb1', labelhash: '0xb1' })
    const child = makeClassified({
      id: '0xc1',
      labelhash: '0xc1',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })

    const ids = await checkPremigrationReservation(publicClient, [
      reserved,
      available,
      child,
    ])

    expect([...ids]).toEqual(['0xb1'])
    expect(multicallMock).toHaveBeenCalledOnce()
    expect(multicallMock.mock.calls[0]?.[1].contracts).toHaveLength(2)
  })

  it('fails closed when a reservation read fails', async () => {
    multicallMock.mockResolvedValueOnce([fail()])
    const failed = new Set<string>()
    const name = makeClassified({ id: '0xa1', labelhash: '0xa1' })

    const ids = await checkPremigrationReservation(publicClient, [name], failed)

    expect([...ids]).toEqual(['0xa1'])
    expect([...failed]).toEqual(['0xa1'])
  })
})

describe('runEligibilityChecks', () => {
  it('returns empty buckets for empty input and issues no RPC', async () => {
    const result = await runEligibilityChecks(publicClient, [], OWNER)
    expect(result).toEqual({
      eligible: [],
      frozen: [],
      alreadyMigrated: [],
      notPremigrated: [],
      failed: [],
    })
    expect(multicallMock).not.toHaveBeenCalled()
  })

  it('composes ownership and frozen into the three buckets', async () => {
    const A = makeClassified({ id: '0xa1', label: 'a', name: 'a.eth' })
    const B = makeClassified({
      id: '0xb1',
      label: 'b',
      name: 'b.eth',
      tokenType: 'locked-2ld',
      fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_APPROVE,
    })
    const C = makeClassified({ id: '0xc1', label: 'c', name: 'c.eth' })
    const expiry = futureWrapperExpiry()

    multicallMock
      .mockResolvedValueOnce([
        ok(OTHER),
        ok([OWNER, 0, expiry] as const),
        ok(OWNER),
      ]) // ownership
      .mockResolvedValueOnce([ok(OTHER)]) // frozen-approval (only B)
      .mockResolvedValueOnce([ok(1), ok(1), ok(1)]) // v2 reservations

    const result = await runEligibilityChecks(publicClient, [A, B, C], OWNER)

    expect(result.alreadyMigrated.map((n) => n.domain.id)).toEqual(['0xa1'])
    expect(result.frozen.map((n) => n.domain.id)).toEqual(['0xb1'])
    expect(result.eligible.map((n) => n.domain.id)).toEqual(['0xc1'])
    expect(result.notPremigrated).toEqual([])
    expect(result.failed).toEqual([])
    expect(multicallMock).toHaveBeenCalledTimes(3)
  })

  it('reports unreadable ownership checks in `failed` (and keeps them out of eligible)', async () => {
    const A = makeClassified({ id: '0xa1', label: 'a', name: 'a.eth' })
    multicallMock
      .mockResolvedValueOnce([fail()]) // ownership read failed
      .mockResolvedValueOnce([ok(1)]) // v2 reservation

    const result = await runEligibilityChecks(publicClient, [A], OWNER)

    expect(result.failed.map((n) => n.domain.id)).toEqual(['0xa1'])
    expect(result.eligible).toEqual([])
    // stays fail-closed for the mutation path
    expect(result.alreadyMigrated.map((n) => n.domain.id)).toEqual(['0xa1'])
  })

  it('keeps an AVAILABLE v2 name out of the migration selection', async () => {
    const A = makeClassified({ id: '0xa1', labelhash: '0xa1' })
    multicallMock
      .mockResolvedValueOnce([ok(OWNER)]) // ownership
      .mockResolvedValueOnce([ok(0)]) // v2 reservation

    const result = await runEligibilityChecks(publicClient, [A], OWNER)

    expect(result.eligible).toEqual([])
    expect(result.notPremigrated).toEqual([A])
    expect(result.failed).toEqual([])
  })
})
