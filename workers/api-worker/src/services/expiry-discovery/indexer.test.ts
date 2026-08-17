import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest, MockClientError } = vi.hoisted(() => {
  class MockClientError extends Error {
    response: { status: number; headers: Headers }
    request: { query: string; variables: Record<string, unknown> }

    constructor(
      response: { status: number; headers: Headers },
      request: { query: string; variables: Record<string, unknown> },
    ) {
      super('GraphQL Client Error')
      this.response = response
      this.request = request
    }
  }

  return {
    mockRequest: vi.fn(),
    MockClientError,
  }
})

vi.mock('graphql-request', () => ({
  request: mockRequest,
  gql: String.raw,
  ClientError: MockClientError,
}))

import { fetchExpiringNamesPage, PAGE_SIZE } from './indexer.js'
import { STAGES } from './stages.js'

describe('fetchExpiringNamesPage', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    vi.useFakeTimers()
  })

  it('sends expected query variables and maps response', async () => {
    mockRequest.mockResolvedValue({
      domains: [
        {
          name: 'alpha.eth',
          expiryDate: 1700000000,
          owner: { id: '0xABC' },
        },
      ],
    })

    const result = await fetchExpiringNamesPage({
      env: {
        ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
      } as CloudflareBindings,
      stage: STAGES[0],
      cursor: 100,
      upperBound: 200,
    })

    expect(result.isOk()).toBe(true)
    expect(mockRequest).toHaveBeenCalledTimes(1)

    const [, document, variables] = mockRequest.mock.calls[0]
    expect(String(document)).toContain(`first: ${PAGE_SIZE}`)
    expect(variables).toEqual({
      cursor: 100,
      upper_bound: 200,
    })

    expect(result._unsafeUnwrap()).toEqual({
      domains: [{ name: 'alpha.eth', expiryDate: 1700000000, owner: '0xabc' }],
      hasMore: false,
    })
  })

  it('retries transient errors and succeeds', async () => {
    mockRequest
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ domains: [] })

    const promise = fetchExpiringNamesPage({
      env: {
        ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
      } as CloudflareBindings,
      stage: STAGES[1],
      cursor: 1,
      upperBound: 2,
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.isOk()).toBe(true)
    expect(mockRequest).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable client errors', async () => {
    const nonRetryableError = new MockClientError(
      {
        status: 400,
        headers: new Headers(),
      },
      { query: 'q', variables: {} },
    )

    mockRequest.mockRejectedValue(nonRetryableError)

    const result = await fetchExpiringNamesPage({
      env: {
        ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
      } as CloudflareBindings,
      stage: STAGES[2],
      cursor: 1,
      upperBound: 2,
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()._tag).toBe('INDEXER_REQUEST_ERROR')
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it('fails on invalid expiryDate values', async () => {
    mockRequest.mockResolvedValue({
      domains: [
        {
          name: 'bad.eth',
          expiryDate: 'not-a-number',
          owner: null,
        },
      ],
    })

    const result = await fetchExpiringNamesPage({
      env: {
        ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
      } as CloudflareBindings,
      stage: STAGES[0],
      cursor: 1,
      upperBound: 2,
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()._tag).toBe('INDEXER_VALIDATION_ERROR')
  })

  it('marks hasMore=true for exactly 1000 rows', async () => {
    mockRequest.mockResolvedValue({
      domains: Array.from({ length: 1000 }, (_, i) => ({
        name: `${i}.eth`,
        expiryDate: 1_700_000_000 + i,
        owner: null,
      })),
    })

    const result = await fetchExpiringNamesPage({
      env: {
        ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
      } as CloudflareBindings,
      stage: STAGES[0],
      cursor: 1,
      upperBound: 2,
    })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().hasMore).toBe(true)
  })
})
