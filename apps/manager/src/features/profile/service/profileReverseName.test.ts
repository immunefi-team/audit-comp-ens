import { ok } from 'neverthrow'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const viemActionMocks = vi.hoisted(() => ({
  getEnsName: vi.fn(),
}))

vi.mock('viem/actions', () => viemActionMocks)

vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok({}),
}))

import { getReverseName } from './profileReverseName'

const ADDRESS = '0xA6362Dcb7Db14C357E788C876eE99e1f982f1115' as Address

describe('getReverseName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the UniversalResolver-verified primary name', async () => {
    viemActionMocks.getEnsName.mockResolvedValue('fgeorgescu.eth')

    const result = await getReverseName(ADDRESS)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('fgeorgescu.eth')
    expect(viemActionMocks.getEnsName).toHaveBeenCalledWith(
      {},
      { address: ADDRESS },
    )
  })

  it('returns null when the address has no verified primary name', async () => {
    // viem's getEnsName returns null both when no reverse record exists and
    // when the on-chain forward-verification fails (ReverseAddressMismatch).
    viemActionMocks.getEnsName.mockResolvedValue(null)

    const result = await getReverseName(ADDRESS)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns null when reverse resolution throws', async () => {
    viemActionMocks.getEnsName.mockRejectedValue(new Error('rpc down'))

    const result = await getReverseName(ADDRESS)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns null without resolving when no address is given', async () => {
    const result = await getReverseName(undefined)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
    expect(viemActionMocks.getEnsName).not.toHaveBeenCalled()
  })
})
