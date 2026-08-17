import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  client: {},
  getBlock: vi.fn(),
  getNameHistory: vi.fn(),
  getRegistrationDate: vi.fn(),
}))

vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getRegistrationDate: mocks.getRegistrationDate,
}))

vi.mock('@ensdomains/ensjs/subgraph', () => ({
  getNameHistory: mocks.getNameHistory,
}))

vi.mock('viem/actions', () => ({
  getBlock: mocks.getBlock,
}))

vi.mock('@/lib/wagmi/helpers', async () => {
  const { ok } = await import('neverthrow')
  return {
    safeGetClient: () => ok(mocks.client),
  }
})

import {
  getRegistration,
  profileRegistrationQuery,
} from './profileRegistration'

describe('profileRegistrationQuery', () => {
  it('includes protocol in the query key', () => {
    expect(profileRegistrationQuery('foo.eth', 'v1').queryKey).toEqual([
      {
        $scope: 'profile',
        $action: 'registration',
        name: 'foo.eth',
        protocol: 'v1',
      },
    ])
  })
})

describe('getRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to the V1 registration event block timestamp when V2 has no registration date', async () => {
    mocks.getRegistrationDate.mockResolvedValue(null)
    mocks.getNameHistory.mockResolvedValue({
      domainEvents: [],
      registrationEvents: [
        {
          blockNumber: 9529458,
          type: 'NameRegistered',
        },
      ],
      resolverEvents: [],
    })
    mocks.getBlock.mockResolvedValue({ timestamp: 1_761_906_936n })

    const result = await getRegistration('fgeorgescu.eth', 'v1')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ registrationDate: 1_761_906_936 })
    expect(mocks.getNameHistory).toHaveBeenCalledWith(mocks.client, {
      name: 'fgeorgescu.eth',
      orderDirection: 'desc',
      first: 25,
    })
    expect(mocks.getBlock).toHaveBeenCalledWith(mocks.client, {
      blockNumber: 9529458n,
    })
  })

  it('uses the latest V1 registration event when history contains older registrations', async () => {
    mocks.getRegistrationDate.mockResolvedValue(null)
    mocks.getNameHistory.mockResolvedValue({
      domainEvents: [],
      registrationEvents: [
        {
          blockNumber: 20,
          type: 'NameRenewed',
        },
        {
          blockNumber: 15,
          type: 'NameRegistered',
        },
        {
          blockNumber: 5,
          type: 'NameRegistered',
        },
      ],
      resolverEvents: [],
    })
    mocks.getBlock.mockResolvedValue({ timestamp: 1_800_000_000n })

    const result = await getRegistration('fgeorgescu.eth', 'v1')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ registrationDate: 1_800_000_000 })
    expect(mocks.getBlock).toHaveBeenCalledWith(mocks.client, {
      blockNumber: 15n,
    })
  })

  it('uses V2 registration data directly for a V2 name', async () => {
    mocks.getRegistrationDate.mockResolvedValue(1_800_000_000n)

    const result = await getRegistration('figma.eth', 'v2')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ registrationDate: 1_800_000_000 })
    expect(mocks.getNameHistory).not.toHaveBeenCalled()
  })
})
