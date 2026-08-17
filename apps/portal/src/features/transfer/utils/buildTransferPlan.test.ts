import { describe, expect, it } from 'vitest'
import { buildTransferPlan, type TransferOptions } from './buildTransferPlan'

const NO_OPTIONS: TransferOptions = {
  setEthAddress: false,
  detachResolver: false,
  detachRegistry: false,
}

describe('buildTransferPlan', () => {
  it('always ends with the token transfer', () => {
    expect(buildTransferPlan(NO_OPTIONS)).toEqual(['transfer-token'])
  })

  it('repoints the ETH address before transferring', () => {
    const plan = buildTransferPlan({ ...NO_OPTIONS, setEthAddress: true })
    expect(plan).toEqual(['set-eth-addr', 'transfer-token'])
  })

  it('skips the ETH step when the resolver is detached (redundant)', () => {
    const plan = buildTransferPlan({
      ...NO_OPTIONS,
      setEthAddress: true,
      detachResolver: true,
    })
    expect(plan).toEqual(['detach-resolver', 'transfer-token'])
  })

  it('detaches the resolver (setResolver 0x0) before transferring', () => {
    const plan = buildTransferPlan({ ...NO_OPTIONS, detachResolver: true })
    expect(plan).toEqual(['detach-resolver', 'transfer-token'])
  })

  it('detaches the registry (setSubregistry 0x0) before transferring', () => {
    const plan = buildTransferPlan({ ...NO_OPTIONS, detachRegistry: true })
    expect(plan).toEqual(['detach-registry', 'transfer-token'])
  })

  it('orders the ETH step before the registry detach', () => {
    const plan = buildTransferPlan({
      setEthAddress: true,
      detachResolver: false,
      detachRegistry: true,
    })
    expect(plan).toEqual(['set-eth-addr', 'detach-registry', 'transfer-token'])
  })

  it('combines detaching the resolver and the registry', () => {
    const plan = buildTransferPlan({
      ...NO_OPTIONS,
      detachResolver: true,
      detachRegistry: true,
    })
    expect(plan).toEqual([
      'detach-resolver',
      'detach-registry',
      'transfer-token',
    ])
  })
})
