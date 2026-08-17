import type { Address } from 'viem'
import type { ClassifiedName } from '../classifyNames'
import type { V1Domain } from '../v1SubgraphClient'

export const OWNER: Address = '0x0000000000000000000000000000000000000001'
export const OTHER: Address = '0x0000000000000000000000000000000000000002'
export const DEFAULT_RESOLVER: Address =
  '0x000000000000000000000000000000000000dddd'

export const ok = <T>(result: T) => ({ status: 'success' as const, result })
export const fail = () => ({
  status: 'failure' as const,
  error: new Error('reverted'),
  result: undefined,
})

export type DomainOverrides = {
  id?: string
  name?: string
  labelName?: string | null
  labelhash?: string
  parentName?: string | null
  parentFuses?: bigint | null
  registrantId?: string | null
  wrappedOwnerId?: string | null
  ownerId?: string
  fuses?: bigint
  resolverAddress?: string | null
  registrationExpiry?: string | null
  wrappedExpiry?: string | null
  isWrapped?: boolean
}

const parentFor = (o: DomainOverrides): V1Domain['parent'] =>
  o.parentName === null
    ? null
    : {
        name: o.parentName ?? 'eth',
        wrappedDomain:
          o.parentFuses == null ? null : { fuses: Number(o.parentFuses) },
      }

const wrappedOwnerFor = (
  o: DomainOverrides,
  isWrapped: boolean,
): V1Domain['wrappedOwner'] => {
  if (o.wrappedOwnerId === null || !isWrapped) return null
  return { id: o.wrappedOwnerId ?? OWNER }
}

export const makeDomain = (o: DomainOverrides = {}): V1Domain => {
  const isWrapped = o.isWrapped ?? false
  return {
    id: o.id ?? '0xabc',
    labelName: o.labelName === undefined ? 'alice' : o.labelName,
    labelhash:
      o.labelhash ??
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    name: o.name ?? 'alice.eth',
    resolver:
      o.resolverAddress === null
        ? null
        : { address: o.resolverAddress ?? DEFAULT_RESOLVER },
    owner: { id: o.ownerId ?? OWNER },
    registrant:
      o.registrantId === null ? null : { id: o.registrantId ?? OWNER },
    wrappedOwner: wrappedOwnerFor(o, isWrapped),
    parent: parentFor(o),
    registration: o.registrationExpiry
      ? { expiryDate: o.registrationExpiry }
      : null,
    wrappedDomain: isWrapped
      ? {
          expiryDate: o.wrappedExpiry ?? '99999999999',
          fuses: Number(o.fuses ?? 0n),
        }
      : null,
  }
}

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

export const jsonResponse = <T>(body: T, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response

type QueryMock = { mockReturnValueOnce: (v: never) => unknown }

export const mockIndexerQuery = (
  queryMock: QueryMock,
  response: { data?: unknown; error?: unknown },
): void => {
  queryMock.mockReturnValueOnce({
    toPromise: () => Promise.resolve(response),
  } as never)
}
