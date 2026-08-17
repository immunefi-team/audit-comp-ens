import { namehash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  client: {},
  getV1Owner: vi.fn(),
  getV2Owner: vi.fn(),
  getV2Domain: vi.fn(),
  queryV2Domain: vi.fn(),
}))

vi.mock('@ens-apps/indexer/urql', () => ({
  default: {
    query: mocks.queryV2Domain,
  },
}))

vi.mock('@ensdomains/ensjs/public/v1', () => ({
  getOwner: mocks.getV1Owner,
}))

vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getOwner: mocks.getV2Owner,
}))

vi.mock('@/lib/wagmi/helpers', async () => {
  const { ok } = await import('neverthrow')
  return {
    safeGetClient: () => ok(mocks.client),
  }
})

import { getOwner } from './profileOwner'

describe('getOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getV2Owner.mockResolvedValue(null)
    mocks.getV2Domain.mockResolvedValue({ data: { domain: null } })
    mocks.queryV2Domain.mockReturnValue({ toPromise: mocks.getV2Domain })
    mocks.getV1Owner.mockResolvedValue(null)
  })

  it('returns V2 ownership without querying V1', async () => {
    mocks.getV2Owner.mockResolvedValue(
      '0x0000000000000000000000000000000000000002',
    )

    const result = await getOwner({ name: 'figma.eth' })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      owner: '0x0000000000000000000000000000000000000002',
      protocol: 'v2',
    })
    expect(mocks.queryV2Domain).not.toHaveBeenCalled()
    expect(mocks.getV1Owner).not.toHaveBeenCalled()
  })

  it('returns V2 protocol without an owner for an expired V2 registration', async () => {
    const domainId = namehash('gloomy.eth')

    mocks.getV2Domain.mockResolvedValue({
      data: { domain: { id: domainId } },
    })

    const result = await getOwner({ name: 'gloomy.eth' })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      owner: undefined,
      protocol: 'v2',
    })
    expect(mocks.queryV2Domain).toHaveBeenCalledWith(expect.anything(), {
      id: domainId,
    })
    expect(mocks.getV1Owner).not.toHaveBeenCalled()
  })

  it('falls back to V1 ownership when V2 has no owner', async () => {
    mocks.getV1Owner.mockResolvedValue({
      owner: '0x0000000000000000000000000000000000000001',
      registrant: '0x0000000000000000000000000000000000000001',
      ownershipLevel: 'registrar',
    })

    const result = await getOwner({ name: 'fgeorgescu.eth' })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      owner: '0x0000000000000000000000000000000000000001',
      protocol: 'v1',
    })
    expect(mocks.queryV2Domain).toHaveBeenCalled()
  })

  it('skips the V2 2LD registration check for subnames', async () => {
    mocks.getV1Owner.mockResolvedValue({
      owner: '0x0000000000000000000000000000000000000001',
      ownershipLevel: 'registry',
    })

    const result = await getOwner({ name: 'sub.fgeorgescu.eth' })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      owner: '0x0000000000000000000000000000000000000001',
      protocol: 'v1',
    })
    expect(mocks.queryV2Domain).not.toHaveBeenCalled()
  })

  it('returns null when neither protocol has an owner or registration', async () => {
    const result = await getOwner({ name: 'unregistered.eth' })

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
    expect(mocks.queryV2Domain).toHaveBeenCalled()
    expect(mocks.getV1Owner).toHaveBeenCalled()
  })
})
