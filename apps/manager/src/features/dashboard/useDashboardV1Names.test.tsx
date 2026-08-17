import { renderHook } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'

const migrationEligibilityMock = vi.hoisted(() => ({
  useMigrationEligibility: vi.fn(),
}))

const v1NamesMock = vi.hoisted(() => ({
  useV1Names: vi.fn(),
}))

const smartAccountMock = vi.hoisted(() => ({
  useSmartAccountContext: vi.fn(),
}))

const wagmiMock = vi.hoisted(() => ({
  useConnection: vi.fn(),
}))

const classifyNamesMock = vi.hoisted(() => ({
  classifyNames: vi.fn(() => ({ classified: [], ineligible: [] })),
}))

vi.mock(
  '@/features/migration/hooks/useMigrationEligibility',
  () => migrationEligibilityMock,
)
vi.mock('@/features/migration/hooks/useV1Names', () => v1NamesMock)
vi.mock('@/features/migration/service/classifyNames', () => classifyNamesMock)
vi.mock('@/lib/smart-account', () => smartAccountMock)
vi.mock('wagmi', () => wagmiMock)

import { useDashboardV1Names } from './useDashboardV1Names'

const USER = '0x1111111111111111111111111111111111111111' as Address
const OTHER = '0x2222222222222222222222222222222222222222'

const makeV1Domain = (overrides: Partial<V1Domain> = {}): V1Domain => ({
  id: overrides.id ?? '0x1',
  labelName: overrides.labelName ?? 'name',
  labelhash: overrides.labelhash ?? '0xlabel',
  name: overrides.name ?? 'name.eth',
  resolver: overrides.resolver ?? null,
  owner: overrides.owner ?? { id: OTHER },
  registrant: overrides.registrant ?? null,
  wrappedOwner: overrides.wrappedOwner ?? null,
  parent: overrides.parent ?? null,
  registration: overrides.registration ?? null,
  wrappedDomain: overrides.wrappedDomain ?? null,
})

describe('useDashboardV1Names', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smartAccountMock.useSmartAccountContext.mockReturnValue({
      ownerAddress: USER,
    })
    wagmiMock.useConnection.mockReturnValue({
      address: undefined,
    })
    migrationEligibilityMock.useMigrationEligibility.mockReturnValue({
      data: undefined,
      isPending: false,
    })
  })

  it('maps V1 role flags using the same relation rules as Explorer', () => {
    v1NamesMock.useV1Names.mockReturnValue({
      data: [
        makeV1Domain({
          id: '0xowner',
          labelName: 'owner-only',
          name: 'owner-only.eth',
          owner: { id: OTHER },
          registrant: { id: USER },
        }),
        makeV1Domain({
          id: '0xmanager',
          labelName: 'manager-only',
          name: 'manager-only.eth',
          owner: { id: USER },
          registrant: { id: OTHER },
        }),
        makeV1Domain({
          id: '0xwrapped',
          labelName: 'wrapped',
          name: 'wrapped.eth',
          owner: { id: OTHER },
          wrappedOwner: { id: USER },
        }),
      ],
      isPending: false,
      isError: false,
    })

    const { result } = renderHook(() =>
      useDashboardV1Names({ migrationEnabled: false }),
    )

    expect(
      result.current.v1Names.map(({ label, nameRoles }) => ({
        label,
        nameRoles,
      })),
    ).toEqual([
      { label: 'owner-only', nameRoles: ['owner'] },
      { label: 'manager-only', nameRoles: ['manager'] },
      { label: 'wrapped', nameRoles: ['owner', 'manager'] },
    ])
  })
})
