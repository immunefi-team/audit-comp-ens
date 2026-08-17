// biome-ignore-all lint/suspicious/noExplicitAny: decoded ABI args need flexible typing in tests

import {
  computeResolverAddress,
  getDestinationContracts,
  primaryNameGas,
} from '@ens-apps/smart-account'
import type { Address, Hex, PublicClient } from 'viem'
import { decodeFunctionData, isAddressEqual, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EOASigner, Signer } from '../../types/signer.types'
import type { RhinestoneTransactionRequest } from '../../types/transaction.types'
import type { PermitSignature } from './registration.actors'
import {
  estimateHcaBudgetActor,
  readUsdcSpend,
  signFundingPermitActor,
  submitFundingAndCommitActor,
  verifyHcaRegistrationActor,
} from './registration.hca.actors'

const startTransaction = vi.fn(() => 'tx-1')
vi.mock('../../providers/transactionManager', () => ({
  transactionManager: {
    startTransaction: (...args: unknown[]) =>
      (startTransaction as unknown as (...a: unknown[]) => string)(...args),
  },
}))

const readContract = vi.fn()
const signTypedData = vi.fn()
const getEip712Domain = vi.fn()
vi.mock('viem/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem/actions')>()),
  readContract: (...args: unknown[]) => readContract(...args),
  signTypedData: (...args: unknown[]) => signTypedData(...args),
  getEip712Domain: (...args: unknown[]) => getEip712Domain(...args),
}))

const C = getDestinationContracts(sepolia.id)

const WALLET = '0x1111111111111111111111111111111111111111' as Address
const HCA = '0xaaaa000000000000000000000000000000000001' as Address
const SESSION_KEY = '0x9999999999999999999999999999999999999999' as Address
const COMMITMENT = `0x${'cc'.repeat(32)}` as Hex

const erc20Abi = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
])

const permit: PermitSignature = {
  owner: WALLET,
  spender: HCA,
  value: 15_000_000n,
  deadline: 1_800_000_000n,
  v: 27,
  r: `0x${'11'.repeat(32)}` as Hex,
  s: `0x${'22'.repeat(32)}` as Hex,
}

const sessionEnable = {
  enableData: { some: 'enable-data' } as never,
  permissionId: `0x${'ab'.repeat(32)}` as Hex,
  sessionKey: SESSION_KEY,
  validUntil: 1_800_000_000n,
}

/** `makeCommitment` is the only read `submitFundingAndCommitActor` makes. */
const commitClient = {
  chain: sepolia,
  readContract: vi.fn().mockResolvedValue(COMMITMENT),
} as unknown as PublicClient

const rhinestoneSigner = { type: 'rhinestone' } as unknown as Signer

const submittedRequest = (): RhinestoneTransactionRequest => {
  const [intent] = startTransaction.mock.calls[0] as unknown as [
    { request: RhinestoneTransactionRequest },
  ]
  return intent.request
}

beforeEach(() => {
  vi.clearAllMocks()
  // `mockClear` keeps queued `...Once` values, so reset the contract reads
  // explicitly — every test queues its own sequence.
  readContract.mockReset()
  getEip712Domain.mockReset()
})

describe('submitFundingAndCommitActor', () => {
  const input = {
    name: 'myname.eth',
    wallet: WALLET,
    hca: HCA,
    duration: 31_536_000n,
    signer: rhinestoneSigner,
    publicClient: commitClient,
  }

  it('bundles funding, session enablement and the commit into one user-paid request', async () => {
    const result = await submitFundingAndCommitActor({
      ...input,
      permit,
      sessionEnable,
    })

    expect(result.isOk()).toBe(true)
    const request = submittedRequest()
    const calls = request.rhinestoneParams.calls

    // permit → transferFrom → enableSessionWithRefund → commit, in this order.
    expect(calls.map((c) => c.to.toLowerCase())).toEqual([
      C.usdc.toLowerCase(),
      C.usdc.toLowerCase(),
      C.hcaOwnerAndSessionValidator.toLowerCase(),
      C.ethRegistrar.toLowerCase(),
    ])

    // The permit pulls exactly the permitted budget into the HCA.
    const transfer = decodeFunctionData({ abi: erc20Abi, data: calls[1].data })
    expect(transfer.functionName).toBe('transferFrom')
    expect((transfer.args as any)[0].toLowerCase()).toBe(WALLET.toLowerCase())
    expect((transfer.args as any)[1].toLowerCase()).toBe(HCA.toLowerCase())
    expect((transfer.args as any)[2]).toBe(permit.value)

    // Paid by the HCA in USDC. Sponsorship is not a request-level concern at
    // all any more — the transport always sends the user-paid shape.
    expect(request.from.toLowerCase()).toBe(HCA.toLowerCase())
    expect(request.rhinestoneParams.feeAsset).toBe('USDC')
    // First-use mode: enableData rides along with the intent.
    expect(request.rhinestoneParams.sessionEnableData).toBe(
      sessionEnable.enableData,
    )
  })

  it('rejects a funding batch whose sessionEnable carries no enableData', async () => {
    // The enable CALL is built from permissionId/sessionKey/validUntil while the
    // PROOF is `enableData`, so a payload with the first three and not the
    // fourth produced a batch containing `enableSessionWithRefund` that was
    // nonetheless signed WITHOUT the proof. The SDK derives the mode solely
    // from `signers.enableData` being truthy, so it silently signed mode 0x02
    // and the validator rejected the permit with ActionNotAllowed(USDC, permit)
    // -- surfaced as InvalidSignature(). The old guard tested the wrapper and
    // let this straight through.
    const { enableData: _dropped, ...hollow } = sessionEnable

    const result = await submitFundingAndCommitActor({
      ...input,
      permit,
      sessionEnable: hollow as typeof sessionEnable,
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toMatch(/enableData=MISSING/)
    // Nothing must reach the orchestrator: an intent signed without the proof
    // burns a real commitment and a real fee before reverting.
    expect(startTransaction).not.toHaveBeenCalled()
  })

  it('declares the permit inflow as auxiliary funds so the intent can be planned', async () => {
    // The HCA's USDC arrives DURING the intent (permit → transferFrom), so the
    // planner cannot see it when it decides whether a route exists. Left
    // undeclared it rejects the intent outright with NO_PLAN_AVAILABLE /
    // SAME_CHAIN_INTENT_NOT_APPLICABLE.
    const result = await submitFundingAndCommitActor({
      ...input,
      permit,
      sessionEnable,
    })

    expect(result.isOk()).toBe(true)
    expect(submittedRequest().rhinestoneParams.auxiliaryFunds).toEqual({
      [sepolia.id]: { [C.usdc]: permit.value },
    })
  })

  it('submits the commit alone once the HCA is funded and the session is enabled', async () => {
    const result = await submitFundingAndCommitActor(input)

    expect(result.isOk()).toBe(true)
    const request = submittedRequest()
    expect(request.rhinestoneParams.calls).toHaveLength(1)
    expect(request.rhinestoneParams.calls[0].to.toLowerCase()).toBe(
      C.ethRegistrar.toLowerCase(),
    )
    expect(request.rhinestoneParams.sessionEnableData).toBeUndefined()
    // Nothing flows in on this path, so there is nothing to declare —
    // over-declaring would inflate the planner's view and the quote with it.
    expect(request.rhinestoneParams.auxiliaryFunds).toBeUndefined()
  })

  it('returns the commitment so the reveal can rebind to the same secret', async () => {
    const result = await submitFundingAndCommitActor(input)

    expect(result._unsafeUnwrap().commitment.commitment).toBe(COMMITMENT)
    // A fresh 32-byte secret per attempt.
    expect(result._unsafeUnwrap().commitment.secret).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

describe('verifyHcaRegistrationActor', () => {
  const publicClient = { chain: sepolia } as unknown as PublicClient
  const hcaResolver = computeResolverAddress({ chainId: sepolia.id, hca: HCA })

  const registeredState = (latestOwner: Address) => ({
    status: 2, // IPermissionedRegistry.Status.REGISTERED
    expiry: 0n,
    latestOwner,
    tokenId: 0n,
    resource: 0n,
  })

  /** `getState` then `getResolver`, in the order the actor reads them. */
  const mockRegistry = (state: unknown, resolver: Address) => {
    readContract
      .mockResolvedValueOnce(state)
      .mockResolvedValueOnce(resolver as unknown)
  }

  const verify = () =>
    verifyHcaRegistrationActor({
      name: 'myname.eth',
      wallet: WALLET,
      hca: HCA,
      publicClient,
    })

  it('verifies a name owned by the wallet and resolved by the HCA resolver', async () => {
    mockRegistry(registeredState(WALLET), hcaResolver)

    expect((await verify())._unsafeUnwrap().verified).toBe(true)
  })

  it('rejects a name whose owner is the HCA instead of the wallet', async () => {
    // The registrar always assigns the name to the wallet; the HCA holding it
    // means the reveal batch registered the wrong owner.
    mockRegistry(registeredState(HCA), hcaResolver)

    expect((await verify())._unsafeUnwrap().verified).toBe(false)
  })

  it('rejects a name pointed at some other resolver', async () => {
    mockRegistry(registeredState(WALLET), WALLET)

    expect((await verify())._unsafeUnwrap().verified).toBe(false)
  })
})

describe('signFundingPermitActor', () => {
  const publicClient = { chain: sepolia } as unknown as PublicClient

  const eoaSigner = (address: Address): Signer =>
    ({
      type: 'eoa',
      walletClient: { account: { address } },
    }) as unknown as EOASigner

  it('refuses to sign with anything but the wallet EOA', async () => {
    const result = await signFundingPermitActor({
      wallet: WALLET,
      hca: HCA,
      value: 15_000_000n,
      approvalSigner: rhinestoneSigner,
      publicClient,
      chainId: sepolia.id,
    })

    expect(result._unsafeUnwrapErr().message).toMatch(/requires an EOA signer/i)
  })

  it('refuses to sign when the connected account is not the permit owner', async () => {
    const result = await signFundingPermitActor({
      wallet: WALLET,
      hca: HCA,
      value: 15_000_000n,
      approvalSigner: eoaSigner(
        '0xdead00000000000000000000000000000000dead' as Address,
      ),
      publicClient,
      chainId: sepolia.id,
    })

    expect(result._unsafeUnwrapErr().message).toMatch(/does not match/i)
  })

  it('reads the token’s EIP-712 version when eip712Domain() is unavailable', async () => {
    // Circle's Sepolia USDC (FiatTokenV2_2) reverts on ERC-5267 and signs its
    // permits over domain version "2" — assuming "1" produced an invalid
    // signature that reverted the funding leg.
    getEip712Domain.mockRejectedValue(new Error('execution reverted'))
    readContract
      .mockResolvedValueOnce(7n) // nonces(wallet)
      .mockResolvedValueOnce(20_000_000n) // balanceOf(wallet)
      .mockResolvedValueOnce('USDC') // name()
      .mockResolvedValueOnce('2') // version()
    signTypedData.mockResolvedValue(`0x${'11'.repeat(32)}${'22'.repeat(32)}1b`)

    const result = await signFundingPermitActor({
      wallet: WALLET,
      hca: HCA,
      value: 15_000_000n,
      approvalSigner: eoaSigner(WALLET),
      publicClient,
      chainId: sepolia.id,
    })

    expect(result.isOk()).toBe(true)
    const [, typedData] = signTypedData.mock.calls[0] as unknown as [
      unknown,
      { domain: { name: string; version: string }; message: any },
    ]
    expect(typedData.domain.version).toBe('2')
    expect(typedData.domain.name).toBe('USDC')
    // Spender is the HCA (it pays the registrar itself), never the registrar.
    expect(typedData.message.spender.toLowerCase()).toBe(HCA.toLowerCase())
    expect(typedData.message.value).toBe(15_000_000n)
    expect(typedData.message.nonce).toBe(7n)
  })

  it('refuses to sign a permit the wallet cannot cover, without prompting', async () => {
    // Regression: the pricing UI gates on the registration PRICE, but the
    // permit is signed for the whole HCA budget (price + both leg costs). A
    // wallet holding between the two used to sign happily and then have the
    // commit batch revert on `transferFrom`, which the orchestrator reports as
    // `Simulation failed: UnclassifiedRevert` / `errorSelector: 0x00000000` —
    // naming neither USDC nor the shortfall.
    getEip712Domain.mockRejectedValue(new Error('execution reverted'))
    readContract
      .mockResolvedValueOnce(0n) // nonces(wallet)
      .mockResolvedValueOnce(20_000_000n) // balanceOf(wallet) — 20.000000 USDC

    const result = await signFundingPermitActor({
      wallet: WALLET,
      hca: HCA,
      value: 20_196_054n, // 20.196054 USDC budget
      approvalSigner: eoaSigner(WALLET),
      publicClient,
      chainId: sepolia.id,
    })

    expect(result._unsafeUnwrapErr().message).toMatch(
      /Insufficient USDC.*Need 20\.196054 USDC.*holds 20 USDC.*short by 0\.196054 USDC/s,
    )
    // The wallet must never be asked to sign a permit that cannot be honoured.
    expect(signTypedData).not.toHaveBeenCalled()
  })
})

describe('readUsdcSpend', () => {
  const usdc = C.usdc

  it('reads the cost from tokensSpent, which is where it actually lives', () => {
    // Captured verbatim from the live orchestrator for a commit-only
    // same-chain intent (gasCost.totalUSD was 0.9065, matching 905736 6dp).
    const cost = {
      tokensSpent: {
        '11155111': {
          '0x768f42455a2d082e23ceef7d51e5787c82d67a39': {
            locked: '0',
            unlocked: '905736',
          },
        },
      },
    }

    expect(readUsdcSpend(cost, sepolia.id)).toBe(905_736n)
  })

  it('matches the token address case-insensitively', () => {
    // The orchestrator echoes addresses lowercased while our contract
    // constants are checksummed. An exact-key lookup misses and silently
    // degrades the budget to the gas fallback.
    expect(usdc).not.toBe(usdc.toLowerCase())

    const cost = {
      tokensSpent: {
        '11155111': {
          [usdc.toLowerCase()]: { locked: '0', unlocked: '12345' },
        },
      },
    }

    expect(readUsdcSpend(cost, sepolia.id)).toBe(12_345n)
  })

  it('sums locked and unlocked, since the account spends both', () => {
    const cost = {
      tokensSpent: {
        '11155111': {
          [usdc.toLowerCase()]: { locked: '1000', unlocked: '2000' },
        },
      },
    }

    expect(readUsdcSpend(cost, sepolia.id)).toBe(3_000n)
  })

  it('returns null rather than 0 when the quote carries no cost for the chain', () => {
    // 0 would be indistinguishable from a free intent and would size a permit
    // at exactly the registration price, leaving nothing for fees.
    expect(readUsdcSpend({ tokensSpent: {} }, sepolia.id)).toBeNull()
    expect(readUsdcSpend(undefined, sepolia.id)).toBeNull()
    expect(
      readUsdcSpend(
        { tokensSpent: { '11155111': { '0xother': { unlocked: '5' } } } },
        sepolia.id,
      ),
    ).toBeNull()
  })

  it('reads 0 when the quote itself prices the intent at nothing', () => {
    // Captured verbatim from the E2E orchestrator, which settles every leg for
    // free: `tokensSpent` is empty not because the quote failed but because
    // there is nothing to spend. Reporting that as unreadable degrades the
    // budget to the fallback, which the no-fallback guard turns into a hard
    // "HCA budget could not be quoted" and fails every registration E2E.
    const freeQuote = {
      tokensSpent: {},
      gasCost: { totalUSD: 0 },
      feeBreakdownUSD: { totalFeeUSD: 0 },
    }

    expect(readUsdcSpend(freeQuote, sepolia.id)).toBe(0n)
  })

  it('requires an explicit zero total, so an unpriced quote stays null', () => {
    // A quote that merely OMITS its totals has not priced anything, and must
    // keep tripping the guard rather than passing as free.
    expect(
      readUsdcSpend({ tokensSpent: {}, gasCost: {} }, sepolia.id),
    ).toBeNull()

    // A non-zero total with no `tokensSpent` entry is a quote we failed to
    // read, not a free intent.
    expect(
      readUsdcSpend(
        { tokensSpent: {}, feeBreakdownUSD: { totalFeeUSD: 0.91 } },
        sepolia.id,
      ),
    ).toBeNull()
  })

  it('prefers a real tokensSpent entry over the zero-cost path', () => {
    // Totals reading 0 must never mask an actual spend.
    expect(
      readUsdcSpend(
        {
          tokensSpent: {
            '11155111': { [usdc.toLowerCase()]: { unlocked: '7' } },
          },
          feeBreakdownUSD: { totalFeeUSD: 0 },
        },
        sepolia.id,
      ),
    ).toBe(7n)
  })
})

describe('estimateHcaBudgetActor', () => {
  const PRICE_BASE = 4_000_000n
  const PRICE_PREMIUM = 0n

  const prepareTransaction = vi.fn()

  const budgetSigner = {
    type: 'rhinestone',
    account: {
      getAddress: () => HCA,
      prepareTransaction: (...args: unknown[]) => prepareTransaction(...args),
    },
  } as unknown as Signer

  /** A quote the orchestrator priced successfully (source stays `'quote'`). */
  const pricedQuote = {
    intentRoute: {
      intentCost: {
        tokensSpent: {
          [String(sepolia.id)]: {
            [C.usdc.toLowerCase()]: { locked: '0', unlocked: '900000' },
          },
        },
      },
    },
  }

  const budgetClient = {
    chain: sepolia,
    // `readRegisterPrice` goes through the client's own method.
    readContract: vi.fn().mockResolvedValue([PRICE_BASE, PRICE_PREMIUM]),
    // Resolver not yet deployed — the batch opens with `deployProxy`.
    getCode: vi.fn().mockResolvedValue('0x'),
  } as unknown as PublicClient

  const input = {
    name: 'myname.eth',
    duration: 31_536_000n,
    publicClient: budgetClient,
    chainId: sepolia.id,
    signer: budgetSigner,
  }

  /** The `prepareTransaction` params for the reveal (register) leg. */
  const registerLegParams = () => {
    // Legs are quoted commit-first, then register.
    const [params] = prepareTransaction.mock.calls[1] as unknown as [
      { calls: { to: Address; data: Hex }[]; gasLimit: bigint },
    ]
    return params
  }

  beforeEach(() => {
    prepareTransaction.mockReset()
    prepareTransaction.mockResolvedValue(pricedQuote)
    // `readHcaUsdcBalanceActor` — the HCA starts empty.
    readContract.mockResolvedValue(0n)
  })

  it('quotes the reveal batch WITH the primary-name call when one is set', async () => {
    // The permit is sized from this quote, so the quoted batch must be the
    // batch that gets submitted. Pricing a reveal without the adapter call
    // under-funds the HCA by that call's fee and the reveal then fails for
    // insufficient USDC — the exact regression this locks.
    const result = await estimateHcaBudgetActor({
      ...input,
      primaryName: 'myname.eth',
    })

    expect(result.isOk()).toBe(true)

    const adapterCall = registerLegParams().calls.find((call) =>
      isAddressEqual(call.to, C.defaultReverseRegistrarHcaAdapter),
    )
    expect(adapterCall).toBeDefined()

    const decoded = decodeFunctionData({
      abi: parseAbi(['function setNameWithHCA(address addr, string name)']),
      // biome-ignore lint/style/noNonNullAssertion: asserted defined above
      data: adapterCall!.data,
    })
    expect(decoded.functionName).toBe('setNameWithHCA')
    // The real name, so the calldata (and cost basis) matches byte for byte.
    expect((decoded.args as any)[1]).toBe('myname.eth')
  })

  it('widens the register gas limit by the primary-name delta', async () => {
    // The rail prices the quote on the LIMIT (measured: /intents/route returns
    // an identical cost for 5 vs 6 executions at the same limit), so a limit
    // that does not cover the extra call under-funds the permit.
    await estimateHcaBudgetActor({ ...input, primaryName: 'myname.eth' })
    const withName = registerLegParams().gasLimit

    prepareTransaction.mockClear()
    await estimateHcaBudgetActor(input)
    const withoutName = registerLegParams().gasLimit

    expect(withName - withoutName).toBe(primaryNameGas('myname.eth'))
  })

  it('scales the widening with the name length', async () => {
    // Measured on a Sepolia fork: <=31 bytes is one SSTORE (34_624 gas) but a
    // 33-byte name is three (79_981). A flat allowance sized for the short
    // case silently under-funds the long one.
    const long = `${'n'.repeat(29)}.eth` // 33 bytes
    expect(long.length).toBeGreaterThan(31)

    await estimateHcaBudgetActor({ ...input, primaryName: long })
    const withLong = registerLegParams().gasLimit

    prepareTransaction.mockClear()
    await estimateHcaBudgetActor({ ...input, primaryName: 'short.eth' })
    const withShort = registerLegParams().gasLimit

    expect(withLong).toBeGreaterThan(withShort)
    expect(withLong - withShort).toBe(
      primaryNameGas(long) - primaryNameGas('short.eth'),
    )
  })

  it('omits the primary-name call when the user did not opt in', async () => {
    await estimateHcaBudgetActor(input)

    expect(
      registerLegParams().calls.some((call) =>
        isAddressEqual(call.to, C.defaultReverseRegistrarHcaAdapter),
      ),
    ).toBe(false)
  })
})
