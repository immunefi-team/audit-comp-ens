import { type Address, zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { ClassifiedName } from './classifyNames'
import { FUSES } from './classifyNames'
import {
  createMigrationData,
  type MigrationData,
  resolverFor,
} from './encodeMigration'

const OWNER: Address = '0x0000000000000000000000000000000000000001'
const RESOLVER: Address = '0x0000000000000000000000000000000000000002'
const SUBREGISTRY: Address = '0x0000000000000000000000000000000000000003'
const DEFAULT_RESOLVER: Address = '0xe7b9a25607e02da8145e4eb1836ca539e53f11f7'
const V1_PUBLIC_RESOLVER: Address = '0x640294a2b2d87e7f522db3e3e3e876764bce170d'

describe('createMigrationData', () => {
  it('defaults subregistry to zeroAddress when not provided', () => {
    expect(
      createMigrationData({ label: 'alice', owner: OWNER, resolver: RESOLVER }),
    ).toEqual({
      label: 'alice',
      owner: OWNER,
      subregistry: zeroAddress,
      resolver: RESOLVER,
    })
  })

  it('uses provided subregistry when given', () => {
    expect(
      createMigrationData({
        label: 'alice',
        owner: OWNER,
        resolver: RESOLVER,
        subregistry: SUBREGISTRY,
      }).subregistry,
    ).toBe(SUBREGISTRY)
  })
})

describe('resolverFor', () => {
  const name = {
    domain: { name: 'alice.eth' },
    resolverStrategy: 'keep-v1',
    v1ResolverAddress: V1_PUBLIC_RESOLVER,
  } as ClassifiedName

  it('expects the remediated migration controller to replace known public resolvers', () => {
    expect(resolverFor(name, DEFAULT_RESOLVER, RESOLVER)).toBe(DEFAULT_RESOLVER)
  })

  it('preserves custom resolvers', () => {
    expect(
      resolverFor(
        { ...name, v1ResolverAddress: RESOLVER },
        DEFAULT_RESOLVER,
        OWNER,
      ),
    ).toBe(RESOLVER)
  })

  it('preserves an empty resolver when a locked name cannot set one', () => {
    expect(
      resolverFor(
        {
          ...name,
          tokenType: 'locked-2ld',
          fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_SET_RESOLVER,
          v1ResolverAddress: null,
        },
        DEFAULT_RESOLVER,
        RESOLVER,
      ),
    ).toBe(zeroAddress)
  })
})

// Note: MigrationData type is verified via TypeScript; no runtime test needed beyond createMigrationData.
const _typeCheck: MigrationData = {
  label: 'test',
  owner: OWNER,
  subregistry: zeroAddress,
  resolver: RESOLVER,
}
void _typeCheck
