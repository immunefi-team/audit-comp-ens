import type { Address, PublicClient } from 'viem'
import type { ClassifiedName } from '../classifyNames'
import type { V1Domain } from '../v1SubgraphClient'

export const OWNER: Address = '0x0000000000000000000000000000000000000001'
export const OTHER: Address = '0x0000000000000000000000000000000000000002'

export const publicClient = {} as PublicClient

export const ok = <T>(result: T) => ({ status: 'success' as const, result })
export const fail = () => ({
  status: 'failure' as const,
  error: new Error('reverted'),
  result: undefined,
})

export type ClassifiedOverrides = {
  tokenType?: ClassifiedName['tokenType']
  resolverStrategy?: ClassifiedName['resolverStrategy']
  v1ResolverAddress?: string | null
  parentName?: string | null
  name?: string
  labelhash?: string
  id?: string
  fuses?: bigint
  label?: string
  managerAddress?: Address | null
  tokenHolder?: Address
}

export const makeClassified = (
  o: ClassifiedOverrides = {},
): ClassifiedName => ({
  tokenType: o.tokenType ?? 'unwrapped',
  label: o.label ?? 'alice',
  parentName: o.parentName === undefined ? 'eth' : o.parentName,
  fuses: o.fuses ?? 0n,
  tokenHolder: o.tokenHolder ?? OWNER,
  v1ResolverAddress:
    o.v1ResolverAddress === undefined ? null : o.v1ResolverAddress,
  resolverStrategy: o.resolverStrategy ?? 'to-owned-permres',
  managerAddress: o.managerAddress ?? null,
  domain: {
    id: o.id ?? '0x01',
    labelhash: o.labelhash ?? '0x02',
    name: o.name ?? 'alice.eth',
  } as unknown as V1Domain,
})
