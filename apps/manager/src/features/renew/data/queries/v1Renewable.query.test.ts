import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getIsV1Renewable,
  getV1RenewableQueryOptions,
} from './v1Renewable.query'

const mocks = vi.hoisted(() => ({
  isRenewable: vi.fn(),
  client: {},
}))

vi.mock('@ensdomains/ensjs/public/v2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ensdomains/ensjs/public/v2')>()),
  isRenewable: mocks.isRenewable,
}))

vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok(mocks.client),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('V1 renewability', () => {
  it.each([
    true,
    false,
  ])('returns the on-chain eligibility result %s', async (value) => {
    mocks.isRenewable.mockResolvedValue(value)

    const result = await getIsV1Renewable('alice.eth')

    expect(result._unsafeUnwrap()).toBe(value)
    expect(mocks.isRenewable).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({ label: 'alice' }),
    )
  })

  it('rejects subnames before querying the renewer', async () => {
    const result = await getIsV1Renewable('sub.alice.eth')

    expect(result.isErr()).toBe(true)
    expect(mocks.isRenewable).not.toHaveBeenCalled()
  })

  it('keys renewability by protocol and renewer', () => {
    const key = getV1RenewableQueryOptions('alice.eth').queryKey?.[0]

    expect(key).toMatchObject({ protocol: 'v1' })
    expect(key && 'renewerAddress' in key).toBe(true)
  })
})
