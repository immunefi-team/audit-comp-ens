import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDnsSecEnabled } from './dnssec'

const mockDohResponse = (body: { AD?: boolean; Status: number }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getDnsSecEnabled', () => {
  it('returns true when DNSSEC validation passes', async () => {
    mockDohResponse({ AD: true, Status: 0 })

    await expect(getDnsSecEnabled('xyz')).resolves.toBe(true)
  })

  it('returns false when the TLD has no DNSSEC', async () => {
    mockDohResponse({ AD: false, Status: 0 })

    await expect(getDnsSecEnabled('example')).resolves.toBe(false)
  })

  it('returns false for TLDs that do not exist in the DNS root', async () => {
    mockDohResponse({ AD: false, Status: 3 })

    await expect(getDnsSecEnabled('notatld')).resolves.toBe(false)
  })
})
