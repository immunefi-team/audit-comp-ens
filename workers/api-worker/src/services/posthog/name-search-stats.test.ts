import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUniqueSearchesLast30dFromPostHog } from './name-search-stats'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getUniqueSearchesLast30dFromPostHog', () => {
  it('calls the endpoint run API and normalizes the unique search count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ unique_searches_last_30d: '17' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getUniqueSearchesLast30dFromPostHog(
        {
          POSTHOG: {
            host: 'https://posthog.example',
            unique_searches_endpoint:
              'api/environments/test/query_endpoints/unique-searches/run/',
          },
          POSTHOG_PERSONAL_API_KEY: 'secret',
        } as CloudflareBindings,
        'vitalik.eth',
      ),
    ).resolves.toMatchObject({ value: 17 })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://posthog.example/api/environments/test/query_endpoints/unique-searches/run/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          variables: { name: 'vitalik.eth' },
        }),
      }),
    )
  })

  it('reads tabular PostHog endpoint results using columns metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [[4]],
          columns: ['unique_searches_last_30d'],
        }),
      }),
    )

    await expect(
      getUniqueSearchesLast30dFromPostHog(
        {
          POSTHOG: {
            host: 'https://posthog.example',
            unique_searches_endpoint:
              'api/environments/test/query_endpoints/unique-searches/run/',
          },
          POSTHOG_PERSONAL_API_KEY: 'secret',
        } as CloudflareBindings,
        'july24.eth',
      ),
    ).resolves.toMatchObject({ value: 4 })
  })

  it('reads the labelled unique search count instead of unrelated numeric fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{ unique_searches_last_30d: 42 }],
        }),
      }),
    )

    await expect(
      getUniqueSearchesLast30dFromPostHog(
        {
          POSTHOG: {
            host: 'https://posthog.example',
            unique_searches_endpoint:
              'api/environments/test/query_endpoints/unique-searches/run/',
          },
          POSTHOG_PERSONAL_API_KEY: 'secret',
        } as CloudflareBindings,
        'vitalik.eth',
      ),
    ).resolves.toMatchObject({ value: 42 })
  })

  it('returns zero when PostHog fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(
      getUniqueSearchesLast30dFromPostHog(
        {
          POSTHOG: {
            host: 'https://posthog.example',
            unique_searches_endpoint:
              'api/environments/test/query_endpoints/unique-searches/run/',
          },
          POSTHOG_PERSONAL_API_KEY: 'secret',
        } as CloudflareBindings,
        'vitalik.eth',
      ),
    ).resolves.toMatchObject({ value: 0 })
  })
})
