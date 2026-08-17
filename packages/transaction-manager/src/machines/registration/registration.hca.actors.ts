/**
 * Standalone-HCA registration actors (user-paid USDC route).
 *
 * These target the STANDALONE-HCA deployment (via `@ens-apps/smart-account`'s
 * manifest) — a different contract set from `ENS_SEPOLIA_CONTRACTS`, which the
 * pure-EOA path (portal) keeps using untouched.
 *
 * Route shape (per the "HCA: New" handoff doc; NO gas sponsorship):
 *   - Commit leg (first HCA action, session-signed, one request):
 *       USDC.permit(wallet, HCA, budget)        — only when funding is needed
 *       USDC.transferFrom(wallet, HCA, budget)  — only when funding is needed
 *       HCAOwnerAndSessionValidator.enableSessionWithRefund(...) — only until enabled
 *       ETHRegistrar.commit(commitment)
 *     The same request lazily deploys the HCA. `sponsored: { gas:false,
 *     bridging:false, swaps:false }`, `feeAsset: 'USDC'` — execution costs are
 *     refunded from the HCA's USDC.
 *   - Reveal leg (after cooldown, session-signed, no wallet prompt):
 *       price re-read immediately before; exact-ordered reveal batch from
 *       `buildRevealBatch` (deployProxy? → approve(price) → register(wallet) →
 *       setters → setNameWithHCA? → authorizeNameRoles).
 */

import {
  buildCommitCall,
  buildEnableSessionWithRefundCall,
  buildRevealBatch,
  computeResolverAddress,
  estimateHcaBudget,
  getDestinationContracts,
  HCA_LEG_GAS_LIMITS,
  type HcaBudgetBreakdown,
  type Call as HcaCall,
  type HcaLeg,
  type QuoteLegResult,
  readCommitment,
  readRegisterPrice,
  registerLegGasLimit,
} from '@ens-apps/smart-account'
import type { Transaction } from '@rhinestone/sdk'
import { errAsync, fromPromise, type ResultAsync } from 'neverthrow'
import type { Address, Chain, Hash, Hex, PublicClient } from 'viem'
import {
  bytesToHex,
  encodeFunctionData,
  formatUnits,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseSignature,
  stringToHex,
} from 'viem'
import { getEip712Domain, readContract, signTypedData } from 'viem/actions'
import { sepolia } from 'viem/chains'
import { transactionManager } from '../../providers/transactionManager'
import type { RhinestoneSigner, Signer } from '../../types/signer.types'
import type {
  Call,
  RhinestoneTransactionRequest,
  SessionEnableData,
} from '../../types/transaction.types'
import type { PermitSignature } from './registration.actors'

type CommitmentData = {
  commitment: Hash
  secret: Hex
}

/** Session-enable payload threaded from the manager (absent once enabled). */
export interface HcaSessionEnableParams {
  readonly enableData: SessionEnableData
  readonly permissionId: Hex
  readonly sessionKey: Address
  readonly validUntil: bigint
}

const erc2612Abi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

const permissionedRegistryAbi = parseAbi([
  'struct State { uint8 status; uint64 expiry; address latestOwner; uint256 tokenId; uint256 resource; }',
  'function getState(uint256 anyId) view returns (State state)',
  'function getResolver(string label) view returns (address)',
])

/** `IPermissionedRegistry.Status.REGISTERED` */
const STATUS_REGISTERED = 2

// Comfortably covers the commitment cooldown plus relayer latency. Permits are
// single-use (nonce-bound), so a generous deadline is not a replay risk.
const PERMIT_DEADLINE_SECONDS = 60 * 60

/** The standalone-HCA registrar for a chain (for the shared cooldown spine). */
export function hcaRegistrarAddress(chainId: number): Address {
  return getDestinationContracts(chainId).ethRegistrar
}

/**
 * Read the USDC (6dp) an intent will spend, from `intentCost.tokensSpent`.
 *
 * NOT `tokensReceived`: that array describes tokens the orchestrator delivers
 * TO the account to satisfy `tokenRequests`, so on this route -- same-chain,
 * nothing bridged in, `tokenRequests: []` -- it is ALWAYS `[]` and reading
 * `[0].amountSpent` always yielded `undefined`. Every budget therefore fell
 * back to the local gas model while reporting itself as a quote failure, which
 * is what the 3% buffer was quietly compensating for. Verified live: a
 * commit-only intent returns `tokensReceived: []` alongside
 * `tokensSpent: {11155111: {<usdc>: {locked: '0', unlocked: '905736'}}}` and
 * `gasCost.totalUSD: 0.9065`, i.e. `unlocked` IS the cost, in 6dp USDC.
 *
 * `locked` covers funds already committed to a resource lock; both are spent
 * by the account, so the cost is their sum.
 *
 * Returns `null` if the quote can't be read, `0n` if it prices the intent at
 * nothing (see `declaresZeroCost`).
 */
export function readUsdcSpend(
  cost: IntentCostShape | undefined,
  chainId: number,
): bigint | null {
  const perToken = cost?.tokensSpent?.[String(chainId)]

  // The orchestrator echoes token addresses LOWERCASED while our contract
  // constants are checksummed, so an exact key lookup silently misses and
  // degrades to the fallback -- the same class of bug this function fixes.
  const usdc = getDestinationContracts(chainId).usdc.toLowerCase()
  const entry = perToken
    ? Object.entries(perToken).find(
        ([token]) => token.toLowerCase() === usdc,
      )?.[1]
    : undefined

  if (!entry) return cost && declaresZeroCost(cost) ? 0n : null

  return BigInt(entry.locked ?? '0') + BigInt(entry.unlocked ?? '0')
}

/**
 * Whether the quote affirmatively prices the intent at nothing.
 *
 * Only consulted when `tokensSpent` carries no entry for our token, because an
 * empty `tokensSpent` is ambiguous: it means EITHER "this intent is free" OR
 * "this quote has no cost data". Treating both as unreadable is what breaks the
 * E2E orchestrator, which fills nothing in and settles every leg for free:
 *
 *   tokensSpent: {}, tokensReceived: [],
 *   gasCost: {destination: {chainId: 11155111, gasUSD: 0}, totalUSD: 0},
 *   feeBreakdownUSD: {..., totalFeeUSD: 0}
 *
 * A total of exactly $0 disambiguates it — the orchestrator has priced the
 * intent and the price is zero, so `0n` is the true spend rather than a guess.
 *
 * Deliberately requires an explicit numeric zero: a quote that simply OMITS its
 * totals stays `null` and still trips the no-fallback guard, so a real quote
 * that fails to price a leg can never be mistaken for a free one.
 */
function declaresZeroCost(cost: IntentCostShape): boolean {
  const totals = [
    cost.feeBreakdownUSD?.totalFeeUSD,
    cost.gasCost?.totalUSD,
  ].filter((total): total is number => typeof total === 'number')

  return totals.length > 0 && totals.every((total) => total === 0)
}

/**
 * Read the USDC (6dp) an intent will spend, straight from a Rhinestone
 * `prepareTransaction` quote. This is the amount the orchestrator actually
 * pulls, so it is immune to the caller's local gas-price reads.
 */
async function quoteIntentSpendUsdc(
  account: RhinestoneSigner['account'],
  chain: Chain,
  calls: Call[],
  gasLimit: bigint,
  signers?: Transaction['signers'],
  /**
   * USDC (6dp) the HCA will hold by fill time but does not hold yet. Without
   * it the planner refuses to price any leg while the HCA sits below the fee,
   * and the budget silently degrades to the gas-limit fallback.
   */
  incomingUsdc?: bigint,
): Promise<QuoteLegResult> {
  const prepared = (await account.prepareTransaction({
    sourceChains: [chain],
    targetChain: chain,
    calls: [...calls],
    sponsored: { gas: false, bridging: false, swaps: false },
    feeAsset: 'USDC',
    tokenRequests: [],
    gasLimit,
    ...(incomingUsdc !== undefined && incomingUsdc > 0n
      ? {
          auxiliaryFunds: {
            [chain.id]: {
              [getDestinationContracts(chain.id).usdc]: incomingUsdc,
            },
          } as Transaction['auxiliaryFunds'],
        }
      : {}),
    ...(signers ? { signers } : {}),
  } as Transaction)) as PreparedQuote

  const route = prepared.intentRoute
  const spend = readUsdcSpend(route?.intentCost, chain.id)

  // The same response carries the orchestrator's own ETH/USDC prices and the
  // destination gas price. Surface them so the fallback model never needs the
  // internal `/deposit-processor/prices` route, which has no CORS headers and
  // therefore always failed in the browser.
  const meta = route?.intentOp?.signedMetadata
  const ethUsd = meta?.tokenPrices?.ETH
  const usdcUsd = meta?.tokenPrices?.USDC
  const gasPriceRaw = meta?.gasPrices?.[String(chain.id)]
  const market =
    ethUsd && ethUsd > 0 && usdcUsd && usdcUsd > 0 && gasPriceRaw
      ? {
          ethUsd8: BigInt(Math.round(ethUsd * 1e8)),
          usdcUsd8: BigInt(Math.round(usdcUsd * 1e8)),
          gasPriceWei: BigInt(gasPriceRaw),
        }
      : undefined

  return {
    // `readUsdcSpend` already encodes readability: `null` means the quote could
    // not be priced, `0n` means it was priced at nothing. Re-testing `> 0n`
    // here would collapse that second case back into "unreadable" and drop the
    // budget to the fallback model, which the no-fallback guard then turns into
    // a hard registration failure -- exactly what breaks against an
    // orchestrator that settles for free.
    spendUsdc: spend,
    ...(market ? { market } : {}),
  }
}

/**
 * Compute the same-chain HCA funding budget at runtime:
 * `commitCost + registerCost + 3%·registerCost + registrationPrice`.
 *
 * Prefers Rhinestone's per-leg quote (`prepareTransaction` → `intentCost`),
 * which reflects the exact USDC the orchestrator pulls and is immune to
 * Sepolia gas-price spikes. Falls back to a clamped gas-limit model per leg
 * when the account/session isn't available or a quote fails.
 */
/**
 * The subset of `intentCost` this module reads, keyed chain -> token.
 *
 * Mirrors the SDK's `IntentCost['tokensSpent']`, but deliberately re-declared
 * as loose/optional: the SDK types the amounts as required and `tokensReceived`
 * as a 1-tuple, while the wire really returns an empty array and may omit
 * fields. Trusting the SDK's shape here is what hid the empty `tokensReceived`.
 */
type IntentCostShape = {
  tokensSpent?: Record<
    string,
    Record<string, { locked?: string; unlocked?: string }>
  >
  /** Aggregate of gas + bridge + protocol + swap + settlement fees. */
  feeBreakdownUSD?: { totalFeeUSD?: number }
  gasCost?: { totalUSD?: number }
}

/** The subset of `prepareTransaction`'s response this module reads. */
type PreparedQuote = {
  intentRoute?: {
    intentCost?: IntentCostShape
    intentOp?: {
      signedMetadata?: {
        tokenPrices?: Record<string, number>
        gasPrices?: Record<string, string>
      }
    }
  }
}

/** The session-signed variant of the SDK's `signers` union. */
type SessionSigners = Extract<
  NonNullable<Transaction['signers']>,
  { type: 'experimental_session' }
>

/** Session-signed `signers` for a quote, or `undefined` to quote owner-signed. */
function sessionSigners(
  activeSession: RhinestoneSigner['session'],
): SessionSigners | undefined {
  return activeSession
    ? {
        type: 'experimental_session',
        session: activeSession.session,
        verifyExecutions: true,
      }
    : undefined
}

/** Attach first-use `enableData`, but only to an existing session signer. */
function withEnableData(
  signers: SessionSigners | undefined,
  enableData: SessionEnableData | undefined,
): SessionSigners | undefined {
  return signers && enableData ? { ...signers, enableData } : signers
}

export function estimateHcaBudgetActor(input: {
  name: string
  duration: bigint
  publicClient: PublicClient
  chainId: number
  signer?: Signer
  sessionEnable?: HcaSessionEnableParams
  /**
   * The primary name the reveal batch will set, when the user opted in. Must
   * be the SAME value handed to `submitRevealBatchActor` — it changes the
   * batch, and this budget sizes the funding permit.
   */
  primaryName?: string
}): ResultAsync<HcaBudgetBreakdown, Error> {
  const label = cleanLabel(input.name)
  const chainId = input.chainId

  // Build a best-effort per-leg quoter whenever we have a Rhinestone account.
  //
  // An active session is NOT required. A first-time user has no session at
  // budget time (it is enabled by the commit leg itself), so gating the quoter
  // on one meant new users could never quote and always fell through to the
  // fallback model — which, because the price service is unreachable from the
  // browser (see `estimateHcaBudget`), degrades further to a flat per-leg fee
  // and massively over-funds the HCA. Without a session we still quote, just
  // owner-signed: the batch shape (and therefore its cost) is the same.
  const rhinestone =
    input.signer?.type === 'rhinestone' ? input.signer : undefined
  const chain = input.publicClient.chain
  const activeSession = rhinestone?.session

  const quoteLegCostUsdc =
    rhinestone && chain
      ? async (leg: HcaLeg, incomingUsdc?: bigint): Promise<QuoteLegResult> => {
          const hca = rhinestone.account.getAddress() as Address
          const resolver = computeResolverAddress({ chainId, hca })
          const baseSigners = sessionSigners(activeSession)
          if (leg === 'commit') {
            // Quote the SAME shape `submitFundingAndCommitActor` submits: when
            // the session still needs enabling, the commit intent carries
            // `enableData` (first-use mode 05) AND an `enableSessionWithRefund`
            // call — both materially change the gas. The funding
            // permit/transferFrom pair is two cheap ERC-20 calls on top; the
            // `HCA_LEG_GAS_LIMITS.commit` bound (a proven upper bound over the
            // measured ~393k first-commit fill, which the rail prices the quote
            // on) covers them, so a successful quote never underfunds the HCA.
            const commitSigners = withEnableData(
              baseSigners,
              input.sessionEnable?.enableData,
            )
            const calls: Call[] = []
            if (input.sessionEnable) {
              const enableCall = buildEnableSessionWithRefundCall({
                chainId,
                permissionId: input.sessionEnable.permissionId,
                sessionKey: input.sessionEnable.sessionKey,
                validUntil: input.sessionEnable.validUntil,
                resolver,
              })
              calls.push({
                to: enableCall.to,
                value: enableCall.value,
                data: enableCall.data,
              })
            }
            const commitCall = buildCommitCall({
              chainId,
              commitment: `0x${'11'.repeat(32)}` as Hex,
            })
            calls.push({
              to: commitCall.to,
              value: commitCall.value,
              data: commitCall.data,
            })
            return quoteIntentSpendUsdc(
              rhinestone.account,
              chain,
              calls,
              HCA_LEG_GAS_LIMITS.commit,
              commitSigners,
              incomingUsdc,
            )
          }
          // register leg: full reveal batch at the current price (the session
          // is enabled by the commit, so no enableData here).
          const price = await readRegisterPrice({
            publicClient: input.publicClient,
            chainId,
            label,
            duration: input.duration,
          })
          const resolverCode = await input.publicClient.getCode({
            address: resolver,
          })
          const revealCalls = buildRevealBatch({
            chainId,
            hca,
            resolver,
            resolverDeployed: Boolean(resolverCode && resolverCode !== '0x'),
            label,
            // The name recipient (wallet). A placeholder is fine for a gas/cost
            // quote — the orchestrator prices the intent by size, not by owner.
            wallet: hca,
            secret: `0x${'22'.repeat(32)}` as Hex,
            price,
            duration: input.duration,
            // Quote the SAME batch `submitRevealBatchActor` submits.
            //
            // This is for fidelity, NOT for pricing. Measured against the live
            // orchestrator: an identical request differing only in this call
            // prices to the same USDC unit (450k gas limit, 5 vs 6 executions
            // → 3277666 both times). The rail prices `/intents/route` purely
            // on `destinationGasUnits`, so what actually funds this call is
            // `registerLegGasLimit` below.
            ...(input.primaryName ? { setPrimaryName: input.primaryName } : {}),
          })
          return quoteIntentSpendUsdc(
            rhinestone.account,
            chain,
            toCalls(revealCalls),
            registerLegGasLimit(input.primaryName),
            baseSigners,
            incomingUsdc,
          )
        }
      : undefined

  return fromPromise(
    (async () => {
      // Read the HCA balance here rather than relying on `checkingHcaFunding`,
      // which runs AFTER this state — the auxiliary-funds declaration must not
      // include funds the HCA already holds.
      const hcaBalanceUsdc = rhinestone
        ? await readHcaUsdcBalanceActor({
            hca: rhinestone.account.getAddress() as Address,
            publicClient: input.publicClient,
            chainId,
          }).unwrapOr(0n)
        : 0n

      const breakdown = await estimateHcaBudget({
        publicClient: input.publicClient,
        chainId,
        label,
        duration: input.duration,
        hcaBalanceUsdc,
        ...(input.primaryName ? { primaryName: input.primaryName } : {}),
        ...(quoteLegCostUsdc ? { quoteLegCostUsdc } : {}),
      })

      // `source` tells you whether the leg costs came from Rhinestone's own
      // quote or from the clamped gas-limit fallback. Without it there is no
      // way to tell which model actually sized the permit at runtime — a
      // silent fallback just over-funds and looks identical to a good quote.
      console.log('🔧 [REGISTRATION] HCA budget:', {
        source: breakdown.source,
        total: breakdown.total,
        commitCost: breakdown.commitCost,
        registerCost: breakdown.registerCost,
        registrationPrice: breakdown.registrationPrice,
        hcaBalanceUsdc,
        ...(breakdown.fallbackReasons
          ? { fallbackReasons: breakdown.fallbackReasons }
          : {}),
      })

      // Fail loudly instead of funding off a guess.
      //
      // The budget carries no buffer any more — it is the sum of two real
      // quotes plus the price — so a fallback is not a slightly-worse estimate,
      // it is an unpriced guess that will over- or under-fund. Now that
      // auxiliary funds let the planner price a low-balance HCA, a fallback
      // means something genuinely broke and the reason is worth surfacing.
      if (breakdown.source !== 'quote') {
        throw new Error(
          `HCA budget could not be quoted (source: ${breakdown.source}). ` +
            `Refusing to size the funding permit from the fallback model. ` +
            `Reasons: ${breakdown.fallbackReasons?.join('; ') ?? 'unknown'}`,
        )
      }

      return breakdown
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

const toCalls = (calls: readonly HcaCall[]): Call[] =>
  calls.map((c) => ({ to: c.to, data: c.data, value: c.value }))

const cleanLabel = (name: string): string => name.replace(/\.eth$/, '')

/** User-paid request shape shared by both legs. */
function buildUserPaidRequest(params: {
  from: Address
  chainId: number
  calls: Call[]
  sessionEnableData?: SessionEnableData
  /**
   * USDC (6dp) this intent will pull into the HCA before it spends anything —
   * i.e. the funding permit's value. Omit when the batch carries no funding
   * pair. See `auxiliaryFunds` on `RhinestoneIntentParams` for why the planner
   * needs telling.
   */
  incomingUsdc?: bigint
}): RhinestoneTransactionRequest {
  const contracts = getDestinationContracts(params.chainId)
  return {
    type: 'rhinestone-intent',
    from: params.from,
    chainId: params.chainId,
    rhinestoneParams: {
      calls: params.calls,
      feeAsset: 'USDC',
      ...(params.sessionEnableData
        ? { sessionEnableData: params.sessionEnableData }
        : {}),
      ...(params.incomingUsdc !== undefined && params.incomingUsdc > 0n
        ? {
            auxiliaryFunds: {
              [params.chainId]: { [contracts.usdc]: params.incomingUsdc },
            },
          }
        : {}),
    },
  }
}

/**
 * Read the HCA's USDC balance (standalone-deployment USDC). Used to skip the
 * funding permit when the HCA already holds enough from a prior registration.
 */
export function readHcaUsdcBalanceActor(input: {
  hca: Address
  publicClient: PublicClient
  chainId: number
}): ResultAsync<bigint, Error> {
  const contracts = getDestinationContracts(input.chainId)
  return fromPromise(
    readContract(input.publicClient, {
      address: contracts.usdc,
      abi: erc2612Abi,
      functionName: 'balanceOf',
      args: [input.hca],
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

/**
 * Sign the HCA funding permit — the SECOND (and last) wallet prompt:
 * EIP-2612 permit with `owner = wallet`, `spender = HCA`, `value = budget`.
 *
 * NOT a registrar allowance: the registrar is paid by the HCA itself inside
 * the reveal batch (`approve(price)` from the HCA's own balance).
 */
export function signFundingPermitActor(input: {
  wallet: Address
  hca: Address
  value: bigint
  approvalSigner: Signer
  publicClient: PublicClient
  chainId: number
}): ResultAsync<PermitSignature, Error> {
  if (input.approvalSigner.type !== 'eoa') {
    return errAsync(
      new Error('Funding permit requires an EOA signer (the wallet).'),
    )
  }
  const walletClient = input.approvalSigner.walletClient
  const account = walletClient.account
  if (!account) {
    return errAsync(new Error('EOA wallet client has no account connected'))
  }
  if (!isAddressEqual(account.address, input.wallet)) {
    return errAsync(
      new Error(
        `Permit signer ${account.address} does not match the wallet ${input.wallet}`,
      ),
    )
  }

  const contracts = getDestinationContracts(input.chainId)

  return fromPromise(
    (async () => {
      const [nonce, walletBalance] = await Promise.all([
        readContract(input.publicClient, {
          address: contracts.usdc,
          abi: erc2612Abi,
          functionName: 'nonces',
          args: [input.wallet],
        }),
        readContract(input.publicClient, {
          address: contracts.usdc,
          abi: erc2612Abi,
          functionName: 'balanceOf',
          args: [input.wallet],
        }),
      ])

      // Preflight the WALLET's balance before prompting for a signature.
      //
      // A permit only authorizes a transfer; it does not make one possible. The
      // pair is honoured by `transferFrom(wallet, HCA, value)` inside the
      // session-signed commit batch, where USDC checks the balance for real. A
      // wallet short by even one 6dp unit reverts that call, and because it is
      // one leg of an atomic batch the WHOLE intent fails — surfacing from the
      // orchestrator as `Simulation failed: UnclassifiedRevert` with
      // `errorSelector: 0x00000000`, which names neither the token nor the
      // shortfall and is not in the validator's error table (see
      // DEBUGGING_INTENTS.md). Catch it here, where both numbers are known.
      //
      // This bound is NOT the one the pricing UI enforces. That screen gates on
      // the registration PRICE; `value` is the funding shortfall for the whole
      // HCA BUDGET (price + both Rhinestone leg costs), which is materially
      // larger — on Sepolia an 8.00 USDC name has run to a ~20.20 USDC budget.
      // A wallet holding between the two passes the UI and then fails
      // simulation, which is exactly the window this check closes.
      if (walletBalance < input.value) {
        throw new Error(
          `Insufficient USDC to fund the registration. Need ` +
            `${formatUnits(input.value, 6)} USDC in ${input.wallet}, ` +
            `but it holds ${formatUnits(walletBalance, 6)} USDC ` +
            `(short by ${formatUnits(input.value - walletBalance, 6)} USDC). ` +
            `The funding amount covers the registration price plus the ` +
            `execution costs of both the commit and register legs, so it is ` +
            `larger than the price shown at checkout.`,
        )
      }

      // Prefer ERC-5267 `eip712Domain()`; fall back to `name()` + `version()`.
      // Circle's Sepolia USDC (FiatTokenV2_2) does NOT implement ERC-5267 (it
      // reverts), and its EIP-712 domain version is "2" — so the fallback MUST
      // read the token's `version()` getter, not assume "1", or the permit
      // signature is computed over the wrong domain and reverts with
      // `EIP2612: invalid signature`.
      let domain: {
        name: string
        version: string
        chainId: number
        verifyingContract: Address
      }
      try {
        const resolved = await getEip712Domain(input.publicClient, {
          address: contracts.usdc,
        })
        domain = {
          name: resolved.domain.name ?? '',
          version: resolved.domain.version ?? '1',
          chainId: Number(resolved.domain.chainId ?? input.chainId),
          verifyingContract:
            (resolved.domain.verifyingContract as Address) ?? contracts.usdc,
        }
      } catch {
        const [name, version] = await Promise.all([
          readContract(input.publicClient, {
            address: contracts.usdc,
            abi: erc2612Abi,
            functionName: 'name',
          }),
          // `version()` is optional on ERC-2612 tokens; default to "1" only
          // when the token doesn't expose it.
          readContract(input.publicClient, {
            address: contracts.usdc,
            abi: erc2612Abi,
            functionName: 'version',
          }).catch(() => '1'),
        ])
        domain = {
          name,
          version,
          chainId: input.chainId,
          verifyingContract: contracts.usdc,
        }
      }

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS,
      )

      const signature = await signTypedData(walletClient, {
        account,
        domain,
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: {
          owner: input.wallet,
          spender: input.hca,
          value: input.value,
          nonce,
          deadline,
        },
      })

      const { r, s, v, yParity } = parseSignature(signature)

      return {
        owner: input.wallet,
        spender: input.hca,
        value: input.value,
        deadline,
        v: Number(v ?? BigInt(yParity + 27)),
        r,
        s,
      } satisfies PermitSignature
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

/**
 * Commit leg: fund the HCA (when needed), enable the session (when needed),
 * and submit the commitment — ONE session-signed, user-paid request. Deploys
 * the HCA lazily when absent. Generates the secret + commitment here so the
 * reveal binds to the exact same inputs.
 */
export function submitFundingAndCommitActor(input: {
  name: string
  wallet: Address
  hca: Address
  duration: bigint
  permit?: PermitSignature
  sessionEnable?: HcaSessionEnableParams
  signer: Signer
  publicClient: PublicClient
  id?: string
}): ResultAsync<
  { txId: string; resolverAddress: Address; commitment: CommitmentData },
  Error
> {
  return fromPromise(
    (async () => {
      // INVARIANT: a funding permit REQUIRES the session-enable proof in the
      // same batch.
      //
      // `HCAOwnerAndSessionValidator` only tolerates the `permit` +
      // `transferFrom` pair inside `_checkInitialRegistrationPolicy`, which is
      // reached by presenting the proof and which strips enable + permit +
      // transfer before applying the fixed policy. Without the proof the pair
      // falls through to `_checkRegistrationExecutions`, whose payment-token
      // branch allows ONLY `approve`:
      //
      //   if (selector != APPROVE_SELECTOR)
      //       revert ActionNotAllowed(execution.target, selector);
      //
      // That reverts `ActionNotAllowed(USDC, 0xd505accf)` (0xde1834f2), which
      // the emissary re-wraps as `InvalidSignature()` (0x8baa579f) — an error
      // that says nothing about the real cause. Fail here instead, where the
      // message can name it.
      // Check `enableData` itself, NOT just its wrapper.
      //
      // Testing `!input.sessionEnable` let a hollow object through: the enable
      // CALL is built from `.permissionId`/`.sessionKey`/`.validUntil` below,
      // while the PROOF is `.enableData`, so a payload carrying the first three
      // and not the fourth produced a batch that contained
      // `enableSessionWithRefund` yet signed without the proof. The SDK picks
      // the mode purely from `signers.enableData` being truthy
      // (`packStandaloneHcaFixedSessionSignature`: truthy -> 0x05 with proof,
      // falsy + gas refund -> 0x02), so an absent proof silently downgrades to
      // 0x02 and the validator then rejects `permit`. That is precisely the
      // failure this guard exists to prevent, and it walked straight past it.
      if (input.permit && !input.sessionEnable?.enableData) {
        throw new Error(
          'HCA funding permit requires the session-enable proof in the same ' +
            'batch: the validator rejects USDC.permit outside the initial ' +
            'registration policy path (ActionNotAllowed(USDC, permit), masked ' +
            'as InvalidSignature()). Attach `sessionEnable.enableData` ' +
            'whenever `permit` is set. Received: ' +
            `sessionEnable=${input.sessionEnable ? 'present' : 'MISSING'}, ` +
            `enableData=${input.sessionEnable?.enableData ? 'present' : 'MISSING'}, ` +
            `permissionId=${input.sessionEnable?.permissionId ?? 'MISSING'}`,
        )
      }

      const chainId = input.publicClient.chain?.id ?? sepolia.id
      const contracts = getDestinationContracts(chainId)
      const label = cleanLabel(input.name)

      const resolverAddress = computeResolverAddress({
        chainId,
        hca: input.hca,
      })

      // Fresh secret per attempt; the commitment binds label/wallet/secret/
      // resolver/duration — the reveal must reuse ALL of them.
      const secret = bytesToHex(
        crypto.getRandomValues(new Uint8Array(32)),
      ) as Hex
      const commitment = await readCommitment({
        publicClient: input.publicClient,
        chainId,
        label,
        wallet: input.wallet,
        secret,
        resolver: resolverAddress,
        duration: input.duration,
      })

      const calls: Call[] = []

      // Funding pair — only when the HCA balance did not cover the budget.
      if (input.permit) {
        calls.push({
          to: contracts.usdc,
          value: 0n,
          data: encodeFunctionData({
            abi: erc2612Abi,
            functionName: 'permit',
            args: [
              input.permit.owner,
              input.permit.spender,
              input.permit.value,
              input.permit.deadline,
              input.permit.v,
              input.permit.r,
              input.permit.s,
            ],
          }),
        })
        calls.push({
          to: contracts.usdc,
          value: 0n,
          data: encodeFunctionData({
            abi: erc2612Abi,
            functionName: 'transferFrom',
            args: [input.permit.owner, input.hca, input.permit.value],
          }),
        })
      }

      // Session enablement — only until the on-chain enable lands.
      if (input.sessionEnable) {
        const enableCall = buildEnableSessionWithRefundCall({
          chainId,
          permissionId: input.sessionEnable.permissionId,
          sessionKey: input.sessionEnable.sessionKey,
          validUntil: input.sessionEnable.validUntil,
          resolver: resolverAddress,
        })
        calls.push({
          to: enableCall.to,
          value: enableCall.value,
          data: enableCall.data,
        })
      }

      const commitCall = buildCommitCall({
        chainId,
        commitment,
      })
      calls.push({
        to: commitCall.to,
        value: commitCall.value,
        data: commitCall.data,
      })

      const request = buildUserPaidRequest({
        from: input.hca,
        chainId,
        calls,
        sessionEnableData: input.sessionEnable?.enableData,
        // Exactly the permit's value — the amount this batch pulls in, and
        // nothing the HCA already holds. `signFundingPermitActor` is signed for
        // `budget - balance`, so the permit value IS the inflow; declaring the
        // whole budget would double-count the standing balance.
        ...(input.permit ? { incomingUsdc: input.permit.value } : {}),
      })

      const txId = transactionManager.startTransaction(
        { type: 'custom', request },
        input.signer,
        {
          id: input.id,
          description: `Set up registration for ${label}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return {
        txId,
        resolverAddress,
        commitment: { commitment, secret },
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

/**
 * Verify a standalone-HCA registration on the NEW registry: the label must be
 * REGISTERED, `latestOwner` must be the WALLET (the registrar always assigns
 * the name to the wallet, never the HCA), and the registry resolver must be
 * the HCA's PermissionedResolver proxy.
 */
export function verifyHcaRegistrationActor(input: {
  name: string
  wallet: Address
  hca: Address
  publicClient: PublicClient
}): ResultAsync<{ verified: boolean }, Error> {
  return fromPromise(
    (async () => {
      const chainId = input.publicClient.chain?.id ?? sepolia.id
      const contracts = getDestinationContracts(chainId)
      const label = cleanLabel(input.name)
      const expectedResolver = computeResolverAddress({
        chainId,
        hca: input.hca,
      })

      const [state, registryResolver] = await Promise.all([
        readContract(input.publicClient, {
          address: contracts.ethRegistry,
          abi: permissionedRegistryAbi,
          functionName: 'getState',
          args: [BigInt(keccak256(stringToHex(label)))],
        }),
        readContract(input.publicClient, {
          address: contracts.ethRegistry,
          abi: permissionedRegistryAbi,
          functionName: 'getResolver',
          args: [label],
        }),
      ])

      const verified =
        Number(state.status) === STATUS_REGISTERED &&
        isAddressEqual(state.latestOwner, input.wallet) &&
        isAddressEqual(registryResolver, expectedResolver)

      return { verified }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

/**
 * Reveal leg: re-read the CURRENT price, then submit the exact-ordered reveal
 * batch session-signed (no wallet prompt, no enable data — the session was
 * enabled by the commit leg).
 */
export function submitRevealBatchActor(input: {
  name: string
  wallet: Address
  hca: Address
  duration: bigint
  secret: Hex
  signer: Signer
  publicClient: PublicClient
  primaryName?: string
  id?: string
}): ResultAsync<string, Error> {
  return fromPromise(
    (async () => {
      const chainId = input.publicClient.chain?.id ?? sepolia.id
      const label = cleanLabel(input.name)

      const resolverAddress = computeResolverAddress({
        chainId,
        hca: input.hca,
      })

      // Price MUST be read immediately before the reveal, never cached.
      const price = await readRegisterPrice({
        publicClient: input.publicClient,
        chainId,
        label,
        duration: input.duration,
      })

      const resolverCode = await input.publicClient.getCode({
        address: resolverAddress,
      })
      const resolverDeployed = Boolean(resolverCode && resolverCode !== '0x')

      const revealCalls = buildRevealBatch({
        chainId,
        hca: input.hca,
        resolver: resolverAddress,
        resolverDeployed,
        label,
        wallet: input.wallet,
        secret: input.secret,
        price,
        duration: input.duration,
        ...(input.primaryName ? { setPrimaryName: input.primaryName } : {}),
      })

      const request = buildUserPaidRequest({
        from: input.hca,
        chainId,
        calls: toCalls(revealCalls),
      })

      const txId = transactionManager.startTransaction(
        { type: 'custom', request },
        input.signer,
        {
          id: input.id,
          description: `Register ${label}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return txId
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}
