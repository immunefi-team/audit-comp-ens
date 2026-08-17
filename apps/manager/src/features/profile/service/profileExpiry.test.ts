import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  client: {},
  getV1Expiry: vi.fn(),
  getV2Expiry: vi.fn(),
}))

vi.mock('@ensdomains/ensjs/public/v1', () => ({
  getExpiry: mocks.getV1Expiry,
}))

vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getExpiry: mocks.getV2Expiry,
}))

vi.mock('@/lib/wagmi/helpers', async () => {
  const { ok } = await import('neverthrow')
  return {
    safeGetClient: () => ok(mocks.client),
  }
})

import {
  getExpiry,
  getProfileExpiryResultStatus,
  profileExpiryQuery,
} from './profileExpiry'

describe('profileExpiryQuery', () => {
  it('includes protocol in the query key', () => {
    expect(profileExpiryQuery('foo.eth', 'v1').queryKey).toEqual([
      {
        $scope: 'profile',
        $action: 'expiry',
        name: 'foo.eth',
        protocol: 'v1',
      },
    ])
  })
})

describe('getExpiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getV2Expiry.mockResolvedValue(0n)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses V1 registrar expiry for a V1 name', async () => {
    mocks.getV1Expiry.mockResolvedValue({
      expiry: 1_793_442_936n,
      gracePeriod: 7_776_000,
      status: 'active',
    })

    const result = await getExpiry('fgeorgescu.eth', 'v1')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      expiry: 1_793_442_936n,
      isNonExpiring: false,
      protocol: 'v1',
    })
    expect(mocks.getV1Expiry).toHaveBeenCalledWith(mocks.client, {
      name: 'fgeorgescu.eth',
    })
  })

  it('does not query V2 registration or expiry for a V1 name', async () => {
    mocks.getV2Expiry.mockResolvedValue(1_801_218_936n)
    mocks.getV1Expiry.mockResolvedValue({
      expiry: 1_793_442_936n,
      gracePeriod: 7_776_000,
      status: 'active',
    })

    const result = await getExpiry('fgeorgescu.eth', 'v1')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      expiry: 1_793_442_936n,
      isNonExpiring: false,
      protocol: 'v1',
    })
    expect(mocks.getV2Expiry).not.toHaveBeenCalled()
    expect(mocks.getV1Expiry).toHaveBeenCalledWith(mocks.client, {
      name: 'fgeorgescu.eth',
    })
  })

  it('uses V2 expiry for a V2 name', async () => {
    mocks.getV2Expiry.mockResolvedValue(1_801_218_936n)

    const result = await getExpiry('fgeorgescu.eth', 'v2')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      expiry: 1_801_218_936n,
      isNonExpiring: false,
      protocol: 'v2',
    })
    expect(mocks.getV1Expiry).not.toHaveBeenCalled()
  })

  it('preserves non-expiring V1 fallback state', async () => {
    mocks.getV1Expiry.mockResolvedValue({
      expiry: 0n,
      gracePeriod: 7_776_000,
      status: 'active',
    })

    const result = await getExpiry('pokemon.eth', 'v1')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      expiry: null,
      isNonExpiring: true,
      protocol: 'v1',
    })
  })

  it('uses V1 grace rules for V1 fallback expiry results', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-15T00:00:00Z'))

    const status = getProfileExpiryResultStatus({
      expiry: BigInt(
        Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000),
      ),
      isNonExpiring: false,
      protocol: 'v1',
    })

    expect(status.isInGrace).toBe(true)
  })
})
