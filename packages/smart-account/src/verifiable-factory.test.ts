import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import {
  computeResolverSalt,
  getDestinationContracts,
} from './providers/rhinestone/manifest'
import { computeVerifiableProxyAddress } from './verifiable-factory'

const HCA = '0xaaaa000000000000000000000000000000000001' as const

describe('computeVerifiableProxyAddress', () => {
  it('derives the pinned VerifiableFactory CREATE2 address', () => {
    const contracts = getDestinationContracts(sepolia.id)

    expect(
      computeVerifiableProxyAddress({
        factory: contracts.verifiableFactory,
        proxyLogic: contracts.verifiableFactoryProxyLogic,
        deployer: HCA,
        salt: computeResolverSalt(HCA),
      }),
    ).toBe('0xcd8d0FAeecC39fbB036c708b697FE4C20c7D41Fd')
  })

  it('namespaces the same salt by deployer', () => {
    const contracts = getDestinationContracts(sepolia.id)
    const first = computeVerifiableProxyAddress({
      factory: contracts.verifiableFactory,
      proxyLogic: contracts.verifiableFactoryProxyLogic,
      deployer: HCA,
      salt: 1n,
    })
    const second = computeVerifiableProxyAddress({
      factory: contracts.verifiableFactory,
      proxyLogic: contracts.verifiableFactoryProxyLogic,
      deployer: '0xbbbb000000000000000000000000000000000002',
      salt: 1n,
    })

    expect(first).not.toBe(second)
  })
})
