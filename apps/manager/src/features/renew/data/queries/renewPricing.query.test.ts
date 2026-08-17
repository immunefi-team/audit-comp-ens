import { describe, expect, it } from 'vitest'
import { getRenewPriceQueryOptions } from './renewPricing.query'

describe('renewal pricing query keys', () => {
  it('separates V1 and V2 prices by protocol and renewer', () => {
    const v1Key = getRenewPriceQueryOptions('alice', 60n, 'USDC', 'v1').queryKey
    const v2Key = getRenewPriceQueryOptions('alice', 60n, 'USDC', 'v2').queryKey

    expect(v1Key).not.toEqual(v2Key)
    expect(v1Key[0]).toMatchObject({
      durationInSeconds: '60',
      protocol: 'v1',
    })
    expect(v2Key[0]).toMatchObject({ protocol: 'v2' })
  })
})
