import { describe, expect, it, vi } from 'vitest'
import { recordNameSearch } from './recordNameSearch'

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
}))

vi.mock('@/lib/posthog/events', () => ({
  track: mocks.track,
}))

describe('recordNameSearch', () => {
  it('tracks the selected name in PostHog', () => {
    recordNameSearch('Vitalik.eth')

    expect(mocks.track).toHaveBeenCalledWith('name:search_selected', {
      name: 'vitalik.eth',
      source: 'header_search',
    })
  })

  it('never throws when PostHog tracking fails', () => {
    mocks.track.mockImplementationOnce(() => {
      throw new Error('posthog blocked')
    })

    expect(() => recordNameSearch('vitalik.eth')).not.toThrow()
  })
})
