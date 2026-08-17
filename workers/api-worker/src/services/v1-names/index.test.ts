import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasV1Names } from './index'

const ADDRESS = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'

const mockFetchResponse = (body: unknown, ok = true, status = 200) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hasV1Names', () => {
  it('returns true when the subgraph returns at least one domain', async () => {
    mockFetchResponse({ data: { domains: [{ id: '0x01' }] } })
    await expect(hasV1Names(ADDRESS)).resolves.toBe(true)
  })

  it('returns false when the subgraph returns no domains', async () => {
    mockFetchResponse({ data: { domains: [] } })
    await expect(hasV1Names(ADDRESS)).resolves.toBe(false)
  })

  it('queries with the lowercased address in owner/registrant/wrappedOwner', async () => {
    const fetchMock = mockFetchResponse({ data: { domains: [] } })
    await hasV1Names(ADDRESS)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    const payload = JSON.parse(init.body)
    const lowered = ADDRESS.toLowerCase()

    expect(payload.variables.whereFilter.and[0]).toEqual({
      or: [
        { owner: lowered },
        { registrant: lowered },
        { wrappedOwner: lowered },
      ],
    })
    // Existence check only — never page through the full name list.
    expect(payload.query).toContain('first: 1')
  })

  it('throws on a non-ok HTTP response (fail-closed for callers)', async () => {
    mockFetchResponse({}, false, 502)
    await expect(hasV1Names(ADDRESS)).rejects.toThrow(
      'V1 subgraph request failed: 502',
    )
  })

  it('throws on GraphQL errors in the response body', async () => {
    mockFetchResponse({ errors: [{ message: 'rate limited' }] })
    await expect(hasV1Names(ADDRESS)).rejects.toThrow(
      'V1 subgraph error: rate limited',
    )
  })
})
