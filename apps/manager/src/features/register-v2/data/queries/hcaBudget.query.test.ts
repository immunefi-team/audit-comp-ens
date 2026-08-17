import { okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  estimateHcaBudgetActor: vi.fn(),
  readHcaUsdcBalanceActor: vi.fn(),
}))

vi.mock('@/lib/wagmi', () => ({ publicClient: {} }))
vi.mock(
  '@ens-apps/transaction-manager/machines/registration/registration.hca.actors',
  () => ({
    estimateHcaBudgetActor: mocks.estimateHcaBudgetActor,
    readHcaUsdcBalanceActor: mocks.readHcaUsdcBalanceActor,
  }),
)

import { getHcaBudgetQueryOptions } from './hcaBudget.query'

const BUDGET = {
  total: 20_196_054n,
  commitCost: 4_000_000n,
  registerCost: 8_196_033n,
  registrationPrice: 8_000_021n,
  source: 'quote' as const,
}

const baseParams = {
  label: 'jeff',
  durationInSeconds: 31_536_000,
  hca: '0x1111111111111111111111111111111111111111' as const,
  signer: { type: 'rhinestone' } as never,
  primaryName: undefined,
  getSessionEnablePayload: () => Promise.resolve(undefined),
}

/** Runs the queryFn and returns the input the estimator was actually called with. */
const runQueryFn = async (
  params: Parameters<typeof getHcaBudgetQueryOptions>[0],
) => {
  mocks.estimateHcaBudgetActor.mockReturnValue(okAsync(BUDGET))
  mocks.readHcaUsdcBalanceActor.mockReturnValue(okAsync(0n))
  const options = getHcaBudgetQueryOptions(params)
  // biome-ignore lint/suspicious/noExplicitAny: exercising the queryFn directly
  const quote = await (options.queryFn as any)({})
  const estimatorInput = mocks.estimateHcaBudgetActor.mock.calls.at(0)?.at(0)
  return { quote, estimatorInput }
}

describe('getHcaBudgetQueryOptions', () => {
  // Each case asserts on the FIRST estimator call, so calls must not carry over.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('quotes the primary-name opt-in the machine will actually submit', async () => {
    // The opt-in widens the register leg's gas limit, and the rail prices the
    // intent purely on gas units. Dropping it here quotes a budget SMALLER than
    // the permit the machine signs, so checkout clears and the permit preflight
    // then rejects the wallet this screen just cleared.
    const { estimatorInput } = await runQueryFn({
      ...baseParams,
      primaryName: 'jeff.eth',
    })

    expect(estimatorInput).toMatchObject({ primaryName: 'jeff.eth' })
  })

  it('omits primaryName entirely when the user opted out', async () => {
    // Absent rather than undefined: the estimator treats the key's presence as
    // the opt-in, so passing it through would over-quote a wallet that never
    // asked to set a primary name.
    const { estimatorInput } = await runQueryFn({
      ...baseParams,
      primaryName: undefined,
    })

    // Key absence, not an undefined value — `expect.anything()` would pass on
    // a present-but-undefined key and miss the distinction that matters.
    expect(Object.keys(estimatorInput ?? {})).not.toContain('primaryName')
  })

  it('keys the cache on the opt-in so toggling refetches', () => {
    const withPrimary = getHcaBudgetQueryOptions({
      ...baseParams,
      primaryName: 'jeff.eth',
    })
    const withoutPrimary = getHcaBudgetQueryOptions(baseParams)

    // Same label and duration — only the toggle differs. Sharing a key would
    // serve the other variant's budget and silently mis-size the gate.
    expect(withPrimary.queryKey).not.toEqual(withoutPrimary.queryKey)
  })

  it('returns the quoted budget alongside the HCA balance', async () => {
    mocks.estimateHcaBudgetActor.mockReturnValue(okAsync(BUDGET))
    mocks.readHcaUsdcBalanceActor.mockReturnValue(okAsync(20_000_000n))

    const options = getHcaBudgetQueryOptions(baseParams)
    // biome-ignore lint/suspicious/noExplicitAny: exercising the queryFn directly
    const quote = await (options.queryFn as any)({})

    expect(quote).toEqual({ ...BUDGET, hcaBalance: 20_000_000n })
  })
})
