import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeDomain, OWNER } from './_fixtures'
import {
  getV1NamesForAddress,
  getV1ProfileKeys,
  type V1Domain,
} from './v1SubgraphClient'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const page = (ids: string[]): V1Domain[] =>
  ids.map((id) => makeDomain({ id, labelhash: `0x${id}`, name: `${id}.eth` }))

const respondWith = (...pages: V1Domain[][]) => {
  for (const p of pages) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { domains: p } }))
  }
}

const readBody = (callIndex = 0) =>
  JSON.parse((fetchMock.mock.calls[callIndex]?.[1] as { body: string }).body)

beforeEach(() => {
  fetchMock.mockReset()
})

describe('getV1NamesForAddress', () => {
  it('returns ok with a single page when less than PAGE_SIZE domains are returned', async () => {
    respondWith(page(['0x01']))
    const result = await getV1NamesForAddress(OWNER)
    assert(result.isOk())
    expect(result.value).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('paginates until a page returns fewer than PAGE_SIZE domains', async () => {
    const p1 = page(Array.from({ length: 1000 }, (_, i) => `p1-${i}`))
    respondWith(p1, page(['p2-0']))
    const result = await getV1NamesForAddress(OWNER)
    assert(result.isOk())
    expect(result.value).toHaveLength(1001)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops paginating on exactly PAGE_SIZE boundary once a partial page arrives', async () => {
    respondWith(page(Array.from({ length: 1000 }, (_, i) => `${i}`)), page([]))
    const result = await getV1NamesForAddress(OWNER)
    assert(result.isOk())
    expect(result.value).toHaveLength(1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('paginates using id_gt cursor from the last domain of the previous page', async () => {
    const first = page(
      Array.from(
        { length: 1000 },
        (_, i) => `0x${i.toString(16).padStart(4, '0')}`,
      ),
    )
    respondWith(first, page(['0xffff']))
    await getV1NamesForAddress(OWNER)

    const firstAnd = readBody(0).variables.whereFilter.and as Record<
      string,
      unknown
    >[]
    expect(firstAnd.some((f) => 'id_gt' in f)).toBe(false)
    expect(readBody(0).variables.orderBy).toBe('id')

    const secondAnd = readBody(1).variables.whereFilter.and as Record<
      string,
      unknown
    >[]
    expect(secondAnd.find((f) => 'id_gt' in f)).toEqual({
      id_gt: first[first.length - 1]?.id,
    })
  })

  it('lowercases the address in the query variables', async () => {
    respondWith([])
    await getV1NamesForAddress('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')
    expect(readBody().variables.whereFilter.and[0].or[0].owner).toBe(
      '0xabcdef0123456789abcdef0123456789abcdef01',
    )
  })

  it.each([
    [
      'HTTP non-ok',
      () => fetchMock.mockResolvedValueOnce(jsonResponse({}, 502)),
    ],
    [
      'GraphQL errors array',
      () =>
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            data: { domains: [] },
            errors: [{ message: 'subgraph boom' }],
          }),
        ),
    ],
  ])('returns err on %s', async (_, setup) => {
    setup()
    const result = await getV1NamesForAddress(OWNER)
    assert(result.isErr())
    expect(result.error._tag).toBe('GetV1NamesError')
  })
})

describe('getV1ProfileKeys', () => {
  it('returns ok with empty array without HTTP when domainIds is empty', async () => {
    const result = await getV1ProfileKeys([])
    assert(result.isOk())
    expect(result.value).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps rows to V1ProfileKeys, defaulting missing resolver fields to empty arrays', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          domains: [
            {
              id: '0x01',
              resolver: {
                texts: ['email'],
                coinTypes: [60],
                contentHash: '0xe301',
                abiChangeds: [
                  { contentType: '1' },
                  { contentType: '1' },
                  { contentType: '2' },
                ],
              },
            },
            { id: '0x02', resolver: null },
            { id: '0x03', resolver: { texts: null, coinTypes: null } },
          ],
        },
      }),
    )
    const result = await getV1ProfileKeys(['0x01', '0x02', '0x03'])
    assert(result.isOk())
    expect(result.value).toEqual([
      {
        id: '0x01',
        texts: ['email'],
        coinTypes: [60],
        contentHash: '0xe301',
        abiContentTypes: [1n, 2n],
      },
      {
        id: '0x02',
        texts: [],
        coinTypes: [],
        contentHash: null,
        abiContentTypes: [],
      },
      {
        id: '0x03',
        texts: [],
        coinTypes: [],
        contentHash: null,
        abiContentTypes: [],
      },
    ])
  })

  it('lowercases each id when building the id_in filter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { domains: [] } }))
    await getV1ProfileKeys(['0xABCD', '0xef01'])
    expect(readBody().variables.whereFilter.id_in).toEqual(['0xabcd', '0xef01'])
  })

  it.each([
    [
      'non-ok HTTP',
      () => fetchMock.mockResolvedValueOnce(jsonResponse({}, 500)),
    ],
    [
      'GraphQL errors',
      () =>
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            data: { domains: [] },
            errors: [{ message: 'bad query' }],
          }),
        ),
    ],
  ])('returns err on %s', async (_, setup) => {
    setup()
    const result = await getV1ProfileKeys(['0x01'])
    assert(result.isErr())
    expect(result.error._tag).toBe('GetV1ProfilesError')
  })

  it('chunks large id_in arrays into batches of 500 and merges results', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `0x${i.toString(16)}`)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            domains: Array.from({ length: 500 }, (_, i) => ({
              id: `0x${i.toString(16)}`,
              resolver: { texts: [], coinTypes: [] },
            })),
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            domains: [
              { id: '0x1f4', resolver: { texts: ['email'], coinTypes: [] } },
            ],
          },
        }),
      )

    const result = await getV1ProfileKeys(ids)
    assert(result.isOk())
    expect(result.value).toHaveLength(501)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readBody(0).variables.whereFilter.id_in).toHaveLength(500)
    expect(readBody(1).variables.whereFilter.id_in).toHaveLength(1)
  })
})
