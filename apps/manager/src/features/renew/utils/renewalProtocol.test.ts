import { ENS_SEPOLIA_CONTRACTS } from '@ens-apps/transaction-manager'
import { describe, expect, it } from 'vitest'
import { getRenewalRoute, getRenewerAddress } from './renewalProtocol'

describe('renewal protocol selection', () => {
  it('selects the V1 renewer and canonical route', () => {
    expect(getRenewerAddress('v1')).toBe(ENS_SEPOLIA_CONTRACTS.ETHRenewerV1)
    expect(getRenewalRoute('v1')).toBe('/renew-v1/$name')
  })

  it('selects the V2 registrar and canonical route', () => {
    expect(getRenewerAddress('v2')).toBe(ENS_SEPOLIA_CONTRACTS.ETHRegistrar)
    expect(getRenewalRoute('v2')).toBe('/renew/$name')
  })
})
