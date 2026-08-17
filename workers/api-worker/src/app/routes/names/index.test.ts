import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectResults: Array<Array<{ value: number }>> = []

const mockDb = {
  select: vi.fn(() => {
    const result = selectResults.shift() ?? []
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => Promise.resolve(result)),
    }
    return chain
  }),
}

const mocks = vi.hoisted(() => ({
  getAvailable: vi.fn(),
  getUniqueSearchesLast30dFromPostHog: vi.fn(),
  createEnsClient: vi.fn(),
}))

vi.mock('#core/database/index.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#core/database/index.js')>()
  return {
    ...actual,
    getDatabase: () => mockDb,
  }
})

vi.mock('#core/eth/client.js', () => ({
  createEnsClient: mocks.createEnsClient,
}))

vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getAvailable: mocks.getAvailable,
}))

vi.mock('#services/posthog/name-search-stats.js', () => ({
  getUniqueSearchesLast30dFromPostHog:
    mocks.getUniqueSearchesLast30dFromPostHog,
}))

import namesApp from './index'

const env = {
  CHAIN: 'sepolia',
  SEPOLIA_RPC_URL: 'https://rpc.example',
  POSTHOG: {
    host: 'https://posthog.example',
    unique_searches_endpoint:
      'api/environments/test/query_endpoints/unique-searches/run/',
  },
  POSTHOG_PERSONAL_API_KEY: 'secret',
} as CloudflareBindings

beforeEach(() => {
  selectResults.length = 0
  vi.clearAllMocks()
  mocks.createEnsClient.mockReturnValue(ok({}))
})

describe('GET /names/:name/stats', () => {
  it('returns favorite count and PostHog unique searches for an unregistered name', async () => {
    selectResults.push([{ value: 425 }])
    mocks.getAvailable.mockResolvedValue(true)
    mocks.getUniqueSearchesLast30dFromPostHog.mockResolvedValue(ok(40))

    const res = await namesApp.request('/names/vitalik.eth/stats', {}, env)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: 'vitalik.eth',
      favorites: 425,
      unique_searches_last_30d: 40,
    })
    expect(mocks.getUniqueSearchesLast30dFromPostHog).toHaveBeenCalledWith(
      env,
      'vitalik.eth',
    )
  })

  it('returns 404 for registered names and does not call PostHog', async () => {
    mocks.getAvailable.mockResolvedValue(false)

    const res = await namesApp.request('/names/vitalik.eth/stats', {}, env)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'Name stats are only available for unregistered names',
    })
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mocks.getUniqueSearchesLast30dFromPostHog).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid names', async () => {
    const res = await namesApp.request('/names/ab.eth/stats', {}, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid name' })
    expect(mocks.getAvailable).not.toHaveBeenCalled()
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mocks.getUniqueSearchesLast30dFromPostHog).not.toHaveBeenCalled()
  })
})
