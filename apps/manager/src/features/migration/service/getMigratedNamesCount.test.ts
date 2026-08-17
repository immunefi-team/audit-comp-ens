import indexerClient from '@ens-apps/indexer/urql'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockIndexerQuery } from './_fixtures'
import { getMigratedNamesCount } from './getMigratedNamesCount'

vi.mock('@ens-apps/indexer/urql', () => ({ default: { query: vi.fn() } }))

const queryMock = vi.mocked(indexerClient.query)
const respond = (r: { data?: unknown; error?: unknown }) =>
  mockIndexerQuery(queryMock, r)

const ADDR = '0x0000000000000000000000000000000000000001'

beforeEach(() => {
  queryMock.mockReset()
})

describe('getMigratedNamesCount', () => {
  it('returns ok with the total count from the indexer', async () => {
    respond({ data: { domainConnection: { totalCount: 42 } } })
    const r = await getMigratedNamesCount(ADDR)
    assert(r.isOk())
    expect(r.value).toBe(42)
  })

  it('returns ok with 0 when totalCount is missing', async () => {
    respond({ data: { domainConnection: {} } })
    const r = await getMigratedNamesCount(ADDR)
    assert(r.isOk())
    expect(r.value).toBe(0)
  })

  it.each([
    ['error', { error: new Error('indexer 500') }],
    ['no data and no error', {}],
  ] as const)('returns err on %s', async (_, response) => {
    respond(response)
    const r = await getMigratedNamesCount(ADDR)
    assert(r.isErr())
    expect(r.error._tag).toBe('GetMigratedNamesCountError')
  })

  it('lowercases the address when building query variables', async () => {
    respond({ data: { domainConnection: { totalCount: 1 } } })
    await getMigratedNamesCount('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')
    const vars = queryMock.mock.calls[0]?.[1] as { where?: { owner?: string } }
    expect(vars?.where?.owner).toBe(
      '0xabcdef0123456789abcdef0123456789abcdef01',
    )
  })
})
