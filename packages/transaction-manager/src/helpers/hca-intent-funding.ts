/**
 * Funding a ONE-OFF HCA intent on the user-paid route.
 *
 * The standalone-HCA deployment takes no gas sponsorship: every intent is paid
 * in USDC out of the HCA's own balance (`sponsored: { gas:false, bridging:false,
 * swaps:false }`, `feeAsset: 'USDC'`). Registration funds that balance inside
 * its commit leg, sized by `estimateHcaBudget` — but the budget carries no
 * buffer, so once a registration settles the HCA is left holding ~nothing.
 *
 * Any LATER standalone action (change the primary name, change a resolver) will
 * therefore find an empty HCA and cannot pay its own fee. The planner will not
 * even price an intent for an account sitting below the fee, so it fails before
 * it is ever submitted. This module closes that gap by re-using registration's
 * funding shape for a single arbitrary batch: quote the fee, and when the HCA
 * cannot cover it, pull exactly the shortfall in from the owner's wallet with an
 * EIP-2612 permit + `transferFrom` pair carried inside the SAME intent.
 *
 * Sponsorship is deliberately NOT the answer here — see `signer.types.ts`.
 */

import { getDestinationContracts } from '@ens-apps/smart-account'
import type { Transaction } from '@rhinestone/sdk'
import type { Address, Chain, Hex, PublicClient } from 'viem'
import { encodeFunctionData, parseAbi } from 'viem'
import {
  readHcaUsdcBalanceActor,
  readUsdcSpend,
  signFundingPermitActor,
} from '../machines/registration/registration.hca.actors'
import type { RhinestoneSigner, Signer } from '../types/signer.types'
import type { Call } from '../types/transaction.types'

const erc2612Abi = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
])

/**
 * Gas LIMIT for a small standalone reverse/resolver intent, quoted against the
 * fully-funded shape (permit + transferFrom + up to two adapter calls) plus the
 * HCA's own execution overhead. The rail prices the quote on this LIMIT, so it
 * must cover the batch or the permit is sized short and the fill fails.
 */
export const HCA_STANDALONE_INTENT_GAS_LIMIT = 300_000n

/**
 * Balance (USDC, 6dp) the first-pass quote pretends the HCA will hold.
 *
 * Only has to comfortably clear any plausible fee for these small intents —
 * the planner refuses to price an account it sees as unable to pay, and the
 * fee itself is read back from the resulting quote.
 */
const FIRST_PASS_BALANCE_USDC = 5_000_000n

/**
 * A permit whose SHAPE matches the real one but whose values are dummies.
 *
 * Quoting is a chicken-and-egg problem: the permit's value is the fee, and the
 * fee comes from the quote. It resolves because every EIP-2612 `permit` argument
 * is fixed-width, so the calldata length — and therefore the quoted cost — is
 * identical whatever value we eventually sign for. Quote with the placeholder,
 * then sign the real permit for the amount it reports.
 */
const placeholderPermitCalls = (
  usdc: Address,
  owner: Address,
  hca: Address,
): Call[] => [
  {
    to: usdc,
    value: 0n,
    data: encodeFunctionData({
      abi: erc2612Abi,
      functionName: 'permit',
      args: [
        owner,
        hca,
        1_000_000n,
        1_800_000_000n,
        27,
        `0x${'11'.repeat(32)}` as Hex,
        `0x${'22'.repeat(32)}` as Hex,
      ],
    }),
  },
  {
    to: usdc,
    value: 0n,
    data: encodeFunctionData({
      abi: erc2612Abi,
      functionName: 'transferFrom',
      args: [owner, hca, 1_000_000n],
    }),
  },
]

/** The subset of `prepareTransaction`'s response this module reads. */
type PreparedQuote = {
  intentRoute?: {
    intentCost?: Parameters<typeof readUsdcSpend>[0]
  }
}

/**
 * Quote what the orchestrator will actually pull for `calls`, in USDC (6dp).
 *
 * `auxiliaryFunds` declares the inflow the funding pair brings in, because the
 * planner credits only balances it can already see and otherwise refuses to
 * price an intent for an HCA sitting below the fee.
 */
async function quoteIntentUsdc(input: {
  account: RhinestoneSigner['account']
  chain: Chain
  calls: readonly Call[]
  declaredInflow: bigint
}): Promise<bigint | null> {
  const { account, chain, calls, declaredInflow } = input
  const usdc = getDestinationContracts(chain.id).usdc

  const prepared = (await account.prepareTransaction({
    sourceChains: [chain],
    targetChain: chain,
    calls: [...calls],
    sponsored: { gas: false, bridging: false, swaps: false },
    feeAsset: 'USDC',
    tokenRequests: [],
    gasLimit: HCA_STANDALONE_INTENT_GAS_LIMIT,
    ...(declaredInflow > 0n
      ? {
          auxiliaryFunds: {
            [chain.id]: { [usdc]: declaredInflow },
          } as Transaction['auxiliaryFunds'],
        }
      : {}),
  } as Transaction)) as PreparedQuote

  return readUsdcSpend(prepared.intentRoute?.intentCost, chain.id)
}

export interface HcaIntentFunding {
  /** The batch to submit: `calls`, preceded by the funding pair when needed. */
  readonly calls: readonly Call[]
  /** USDC (6dp) this intent pulls in. Absent when no funding was needed. */
  readonly incomingUsdc?: bigint
  /**
   * Ready-made `rhinestoneParams.auxiliaryFunds` for the inflow above — the
   * planner refuses to price an HCA that cannot cover the fee out of balances
   * it can already see, so this must be spread into the request whenever the
   * funding pair is present. Absent when no funding was needed.
   */
  readonly auxiliaryFunds?: Readonly<
    Record<number, Readonly<Record<Address, bigint>>>
  >
  /** The quoted fee, for logging/telemetry. */
  readonly quotedFeeUsdc: bigint
}

export interface PlanHcaIntentFundingParams {
  /** The HCA signer the intent runs on. */
  readonly signer: RhinestoneSigner
  /** The owner EOA whose wallet funds the shortfall. */
  readonly ownerAddress: Address
  /** Owner wallet client, as an EOA signer — signs the EIP-2612 permit. */
  readonly approvalSigner: Signer
  readonly publicClient: PublicClient
  readonly chainId: number
  /** The action calls. The funding pair, when needed, is prepended to these. */
  readonly calls: readonly Call[]
}

/**
 * Size and attach funding for a standalone HCA intent.
 *
 * Quotes the FULLY-FUNDED batch every time, then drops the funding pair if the
 * HCA turns out to already cover the fee. Quoting the shape you might submit —
 * rather than the bare action — is what keeps the permit from being sized
 * against a smaller batch than the one that fills.
 *
 * Throws rather than guessing: an unpriceable quote means the permit amount is
 * unknown, and a wrong permit either under-funds (the fill reverts) or moves
 * more of the user's USDC into the HCA than the action needed.
 */
export async function planHcaIntentFunding(
  params: PlanHcaIntentFundingParams,
): Promise<HcaIntentFunding> {
  const { signer, ownerAddress, approvalSigner, publicClient, chainId, calls } =
    params

  const chain = publicClient.chain
  if (!chain) {
    throw new Error('Cannot fund an HCA intent without a chain-bound client.')
  }

  const hca = signer.account.getAddress() as Address
  const usdc = getDestinationContracts(chainId).usdc

  // Deliberately NOT `unwrapOr(0n)`: an unread balance is unknown, not empty.
  // `balance` sets the shortfall the permit is signed for, so defaulting it to
  // zero on a failed read is exactly the guess this function refuses to make
  // elsewhere — it would pull the full fee out of the owner's wallet into an
  // HCA that may already have been holding it.
  const balance = await readHcaUsdcBalanceActor({
    hca,
    publicClient,
    chainId,
  }).match(
    (value) => value,
    (error) => {
      throw error
    },
  )

  const fundedCalls: Call[] = [
    ...placeholderPermitCalls(usdc, ownerAddress, hca),
    ...calls,
  ]

  // First-pass inflow: tops the HCA up to `FIRST_PASS_BALANCE_USDC` so the
  // planner sees it as covered and prices the legs at all. The real permit is
  // sized from the quote this produces, never from this number.
  //
  // Keyed on "below the target", NOT on "exactly zero". The planner refuses to
  // price ANY account sitting under the fee, so a dust balance — say 0.3 USDC
  // against a 0.9 fee — is just as unpriceable as an empty one, and declaring
  // nothing there made the quote fail and this function throw. A settled
  // registration lands squarely in that band.
  //
  // Declaring an inflow for an HCA that turns out to cover the fee anyway is
  // harmless: the quote prices on `gasLimit`, so the fee comes back the same,
  // and the `balance >= quotedFeeUsdc` branch below then drops the funding pair.
  const declaredInflow =
    balance >= FIRST_PASS_BALANCE_USDC ? 0n : FIRST_PASS_BALANCE_USDC - balance

  const quotedFeeUsdc = await quoteIntentUsdc({
    account: signer.account,
    chain,
    calls: fundedCalls,
    declaredInflow,
  })

  if (quotedFeeUsdc === null) {
    throw new Error(
      'Could not quote the HCA intent, so the funding permit cannot be sized. ' +
        'Refusing to fall back to a guessed amount.',
    )
  }

  if (balance >= quotedFeeUsdc) {
    // The HCA already covers it — submit the bare action. The quote was taken
    // over a larger batch, so it only over-estimated, which is safe here
    // because nothing is being permitted.
    return { calls: [...calls], quotedFeeUsdc }
  }

  const shortfall = quotedFeeUsdc - balance

  const permit = await signFundingPermitActor({
    wallet: ownerAddress,
    hca,
    value: shortfall,
    approvalSigner,
    publicClient,
    chainId,
  }).match(
    (signed) => signed,
    (error) => {
      throw error
    },
  )

  return {
    calls: [
      {
        to: usdc,
        value: 0n,
        data: encodeFunctionData({
          abi: erc2612Abi,
          functionName: 'permit',
          args: [
            permit.owner,
            permit.spender,
            permit.value,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s,
          ],
        }),
      },
      {
        to: usdc,
        value: 0n,
        data: encodeFunctionData({
          abi: erc2612Abi,
          functionName: 'transferFrom',
          args: [permit.owner, hca, permit.value],
        }),
      },
      ...calls,
    ],
    incomingUsdc: shortfall,
    auxiliaryFunds: { [chainId]: { [usdc]: shortfall } },
    quotedFeeUsdc,
  }
}
