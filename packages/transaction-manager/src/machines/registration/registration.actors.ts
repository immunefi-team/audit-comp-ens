/**
 * Registration Actor Functions
 *
 * Pure functions for ENS registration operations.
 */

import {
  ethRegistrarCommitmentsSnippet,
  ethRegistrarCommitSnippet,
  ethRegistrarGetRegisterPriceSnippet,
  ethRegistrarMakeCommitmentSnippet,
  ethRegistrarRegisterSnippet,
  ethRegistrarRenewSnippet,
} from '@ensdomains/ensjs-abi/v2/ethRegistrar'
import { errAsync, fromPromise, ResultAsync } from 'neverthrow'
import type {
  Address,
  Hash,
  Hex,
  MulticallErrorType,
  PublicClient,
  TransactionReceipt,
} from 'viem'
import {
  bytesToHex,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  keccak256,
  parseAbi,
  stringToBytes,
  zeroAddress,
} from 'viem'
import { getBlock, multicall, readContract } from 'viem/actions'
import { sepolia } from 'viem/chains'
import type { Signer } from '../..'
import { VERIFIABLE_FACTORY_ABI } from '../../contracts/abis/VerifiableFactory.abi'
import { getSmartAccountAddress } from '../../helpers/getSmartAccountAddress'

// `MIN_COMMITMENT_AGE` is an immutable on ETHRegistrar; ensjs-abi does not (yet)
// expose a dedicated snippet for it.
const ethRegistrarMinCommitmentAgeSnippet = parseAbi([
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
])

import {
  ENS_SEPOLIA_CONTRACTS,
  REFERER_ADDRESS,
  type TOKEN_SYMBOL,
  TOKENS,
} from '../../contracts/ens-sepolia'
import { assertPaymentTokenSupported } from '../../contracts/paymentToken'
import { waitForTransactionReceiptById } from '../../helpers/transaction-status.helpers'
import { transactionManager } from '../../providers/transactionManager'
import type { Call, TransactionRequest } from '../../types/transaction.types'

type CommitmentData = {
  commitment: Hash
  secret: Hash
}

// `PermissionedResolver.initialize` takes a third `setters` argument — a
// multicall batch of setter calls run at init time. We pass an empty array:
// the proxy is deployed with no initial records, exactly as before.
// See contracts-v2 `src/resolver/PermissionedResolver.sol`.
const DEDICATED_RESOLVER_INIT_ABI = parseAbi([
  'function initialize(address owner, uint256 bitmap, bytes[] setters)',
])

const DEDICATED_RESOLVER_ROLE_BITMAP = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

/**
 * The ERC-20 amount to approve for a single EOA registration/renewal at
 * `price`. Deliberately NOT unlimited: the registrar pulls the live rent price
 * (no max-price arg), which can drift slightly between quote and execution; we
 * add 10% headroom to absorb that while keeping the allowance tightly scoped.
 * (Used only on the pure-EOA `approve` path — the HCA path funds via permit.)
 */
function authorizedPaymentAmount(price: bigint): bigint {
  return price + price / 10n
}

// ============================================================================
// Helper Functions (only used in this file)
// ============================================================================

function generateResolverSalt(name: string): bigint {
  // Use CSPRNG (not `Date.now()`/`Math.random()`) so the resolver salt is
  // unpredictable. The CREATE2 address is also bound to the deployer via
  // `keccak256(abi.encode(msg.sender, salt))`, but unpredictable randomness is
  // the correct hygiene for any on-chain-influencing value.
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return BigInt(keccak256(stringToBytes(`${name}:${bytesToHex(randomBytes)}`)))
}

function getResolverInitCalldata(ownerAddress: Address): Hex {
  return encodeFunctionData({
    abi: DEDICATED_RESOLVER_INIT_ABI,
    functionName: 'initialize',
    args: [ownerAddress, DEDICATED_RESOLVER_ROLE_BITMAP, []],
  })
}

function parseProxyDeployedAddress(
  receipt: TransactionReceipt,
): Address | undefined {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: VERIFIABLE_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName === 'ProxyDeployed') {
        return decoded.args.proxyAddress as Address
      }
    } catch {
      // Ignore non-matching logs
    }
  }
  return undefined
}

/**
 * Generate commitment hash via contract call
 * Note: Uses makeCommitment (NOT makeCommitmentWithToken)
 * Payment token is specified during registration, not commitment
 */
function generateCommitment(
  publicClient: PublicClient,
  name: string,
  ownerAddress: Address,
  duration: bigint,
  resolverAddress: Address,
  registrarAddress: Address = ENS_SEPOLIA_CONTRACTS.ETHRegistrar,
): ResultAsync<CommitmentData, Error> {
  const cleanName = name.replace('.eth', '')
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.getRandomValues !== 'function'
  ) {
    return errAsync(new Error('crypto.getRandomValues is not available'))
  }
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const secret = bytesToHex(secretBytes) as Hash

  return fromPromise(
    (async () => {
      const commitment = await readContract(publicClient, {
        address: registrarAddress,
        abi: ethRegistrarMakeCommitmentSnippet,
        functionName: 'makeCommitment',
        args: [
          cleanName,
          ownerAddress,
          secret,
          zeroAddress,
          resolverAddress,
          duration,
          REFERER_ADDRESS,
        ],
      })
      return { commitment, secret }
    })(),
    (error) => {
      console.error('❌ Failed to generate commitment:', error)
      return new Error(`Failed to generate commitment: ${error}`)
    },
  )
}

/**
 * Encode commitment transaction data
 */
function encodeCommitmentData(commitment: Hash): Hash {
  return encodeFunctionData({
    abi: ethRegistrarCommitSnippet,
    functionName: 'commit',
    args: [commitment],
  })
}

/**
 * Encode token approval transaction data.
 *
 * Scoped approve to the registrar — NOT unlimited. The ENS registrar pulls the
 * payment token from the name owner (the EOA) on registration; on the pure-EOA
 * fallback path that approve is a direct EOA tx (the HCA path uses a gasless
 * EIP-2612 permit instead). We approve only this registration's price plus a
 * small headroom, matching the permit path, so a stale/compromised registrar
 * approval can never drain more than one registration's worth.
 */
function encodeTokenApprovalData(
  registrarAddress: Address,
  value: bigint,
): Hash {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [registrarAddress, value],
  })
}

/**
 * A signed EIP-2612 permit (shared type, produced by the HCA funding-permit
 * actor and consumed when encoding the `permit(...)` call).
 */
export type PermitSignature = {
  owner: Address
  spender: Address
  value: bigint
  deadline: bigint
  v: number
  r: Hex
  s: Hex
}

/** Shared `ETHRegistrar.register` call for submit + gas estimate. */
export function encodeRegisterCall({
  name,
  owner,
  secret,
  duration,
  paymentToken,
  resolverAddress,
}: {
  name: string
  owner: Address
  secret: Hash
  duration: bigint
  paymentToken: Address
  resolverAddress: Address
}): { to: Address; data: Hex; value: bigint } {
  return {
    to: ENS_SEPOLIA_CONTRACTS.ETHRegistrar,
    data: encodeFunctionData({
      abi: ethRegistrarRegisterSnippet,
      functionName: 'register',
      args: [
        name.replace('.eth', ''),
        owner,
        secret,
        zeroAddress,
        resolverAddress,
        duration,
        paymentToken,
        REFERER_ADDRESS,
      ],
    }),
    value: 0n,
  }
}

/**
 * Get payment token address
 */
function getPaymentTokenAddress(token: TOKEN_SYMBOL): Address {
  return TOKENS[token].address
}

export function getSignerAddress(signer: Signer): Address {
  if (signer.type === 'eoa') {
    const account = signer.walletClient.account

    if (!account) {
      throw new Error('EOA wallet client has no account connected')
    }
    return account.address
  }

  if (signer.type === 'rhinestone') {
    // Delegate so the cached-address verification lives in one place.
    return getSmartAccountAddress(signer)
  }

  signer satisfies never
  throw new Error('Only EOA or Rhinestone signer is supported for registration')
}

/**
 * Create a transaction request based on signer type.
 *
 * `calls` is the single source of truth for the call data. For an EOA signer
 * the request is a single on-chain transaction, so exactly one call is allowed
 * and its `{ to, data, value }` become the request's top-level fields. For a
 * Rhinestone signer the calls are submitted as a batched intent and stored
 * verbatim in `rhinestoneParams.calls`; there is no separate top-level copy to
 * keep in sync. This removes the previous "two sources of truth" footgun where
 * callers passed a top-level call that could disagree with `calls`.
 */
export function createTransactionRequest(params: {
  signer: Signer
  from: Address
  chainId: number
  calls: Call[]
}): TransactionRequest {
  const { signer, from, chainId, calls } = params

  if (calls.length === 0) {
    throw new Error('createTransactionRequest requires at least one call')
  }

  if (signer.type === 'eoa') {
    if (calls.length > 1) {
      throw new Error(
        'EOA transaction requests support a single call; received a batch. ' +
          'Use a Rhinestone signer for multi-call intents.',
      )
    }
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const call = calls[0]!
    return {
      type: 'eoa',
      from,
      to: call.to,
      data: call.data,
      value: call.value,
      chainId,
    }
  }

  if (signer.type === 'rhinestone') {
    return {
      type: 'rhinestone-intent',
      from,
      chainId,
      rhinestoneParams: { calls },
    }
  }

  signer satisfies never
  throw new Error('Unsupported signer type for transaction request')
}

// ============================================================================
// Actor Functions (exported for use with fromResultAsync in machine)
// ============================================================================

/**
 * Deploy dedicated resolver proxy through verifiable factory
 */
export function submitResolverDeploymentActor(input: {
  name: string
  owner: Address
  signer: import('../..').Signer
  publicClient: PublicClient
  id?: string
}): ResultAsync<{ txId: string; salt: bigint }, Error> {
  return ResultAsync.fromSafePromise(
    Promise.resolve().then(() => {
      const accountAddress = getSignerAddress(input.signer)
      const salt = generateResolverSalt(input.name)

      const request = createTransactionRequest({
        signer: input.signer,
        from: accountAddress,
        chainId: input.publicClient.chain?.id ?? sepolia.id,
        calls: [
          encodeDeployDedicatedResolverCall({ owner: input.owner, salt }),
        ],
      })

      const txId = transactionManager.startTransaction(
        {
          type: 'custom',
          request,
        },
        input.signer,
        {
          id: input.id,
          description: `Deploy dedicated resolver for ${input.name}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return { txId, salt }
    }),
  ).mapErr(
    (error) => new Error(`Failed to submit resolver deployment: ${error}`),
  )
}

/**
 * The `VerifiableFactory.deployProxy` call that deploys a name's dedicated
 * resolver. Exported so the app can build the SAME deploy call for its pre-start
 * gas estimate (wrapped as an EOA intent), keeping the estimate byte-identical
 * to what {@link submitResolverDeploymentActor} submits — the encoding lives in
 * one place and can't drift. Deploy gas is independent of the salt value, so the
 * estimate may pass a stable throwaway salt.
 */
export function encodeDeployDedicatedResolverCall(input: {
  owner: Address
  salt: bigint
}): { to: Address; data: Hex; value: bigint } {
  return {
    to: ENS_SEPOLIA_CONTRACTS.VerifiableFactory,
    data: encodeFunctionData({
      abi: VERIFIABLE_FACTORY_ABI,
      functionName: 'deployProxy',
      args: [
        ENS_SEPOLIA_CONTRACTS.PermissionedResolverImpl,
        input.salt,
        getResolverInitCalldata(input.owner),
      ],
    }),
    value: 0n,
  }
}

/**
 * Wait for resolver deployment transaction and extract deployed proxy address
 */
export function resolveResolverDeploymentActor(input: {
  txId: string
}): ResultAsync<{ resolverAddress: Address }, Error> {
  return fromPromise(
    (async () => {
      const receipt = await waitForTransactionReceiptById(input.txId)
      const resolverAddress = parseProxyDeployedAddress(receipt)

      if (!resolverAddress) {
        throw new Error(
          'ProxyDeployed event not found in resolver deployment receipt',
        )
      }

      return { resolverAddress }
    })(),
    (error) => error as Error,
  )
}

/**
 * Generate commitment for ENS registration
 */
export function generateCommitmentActor(input: {
  name: string
  owner: Address
  duration: bigint
  publicClient: PublicClient
  selectedToken: TOKEN_SYMBOL
  resolverAddress: Address
}): ResultAsync<CommitmentData, Error> {
  const registrarAddress = ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return generateCommitment(
    input.publicClient,
    input.name,
    input.owner,
    input.duration,
    input.resolverAddress,
    registrarAddress,
  )
}

/**
 * Submit commitment transaction via transaction manager
 */
export function submitCommitmentActor(input: {
  commitment: CommitmentData
  signer: import('../..').Signer
  name: string
  duration: bigint
  publicClient: PublicClient
  id?: string
}): ResultAsync<string, Error> {
  const registrarAddress = ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return fromPromise(
    (async () => {
      console.log(
        `🔧 [REGISTRATION ACTOR] submitCommitmentActor called with:`,
        {
          hasPublicClient: !!input.publicClient,
          hasSigner: !!input.signer,
          signerType: input.signer?.type,
          name: input.name,
        },
      )

      const accountAddress = getSignerAddress(input.signer)

      const commitmentData = encodeCommitmentData(input.commitment.commitment)

      console.log(
        `🔧 [REGISTRATION ACTOR] About to call startTransaction with publicClient:`,
        !!input.publicClient,
      )

      const request = createTransactionRequest({
        signer: input.signer,
        from: accountAddress,
        chainId: input.publicClient.chain?.id ?? sepolia.id,
        calls: [
          {
            to: registrarAddress,
            data: commitmentData,
            value: 0n,
          },
        ],
      })

      const txId = transactionManager.startTransaction(
        {
          type: 'custom',
          request,
        },
        input.signer,
        {
          id: input.id,
          description: `Commit to register ${input.name}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return txId
    })(),
    (error) => error as Error,
  )
}

/**
 * Read MIN_COMMITMENT_AGE from the registrar contract so the cooldown timer
 * matches the deployment (60s on the production v2 ETHRegistrar).
 */
export function readMinCommitmentAgeActor(input: {
  publicClient: PublicClient
  /** Override for the standalone-HCA registrar; defaults to the EOA deployment. */
  registrarAddress?: Address
}): ResultAsync<bigint, Error> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar
  return fromPromise(
    readContract(input.publicClient, {
      address: registrarAddress,
      abi: ethRegistrarMinCommitmentAgeSnippet,
      functionName: 'MIN_COMMITMENT_AGE',
    }),
    (error) => {
      console.warn(
        '⚠️ [REGISTRATION ACTOR] Failed to read MIN_COMMITMENT_AGE, defaulting to 60s:',
        error,
      )
      return error as Error
    },
  )
}

/**
 * Read the current ERC20 allowance the spender (registrar) has on the user's
 * payment token. Used by the renewal flows, whose price comes from the renew
 * quote; the registration machine uses `readPaymentAuthorizationActor` below,
 * which pairs the allowance with the live register price.
 */
export function readPaymentTokenAllowanceActor(input: {
  owner: Address
  selectedToken: TOKEN_SYMBOL
  publicClient: PublicClient
  /** Spender to read the allowance for. Defaults to the legacy registrar. */
  registrarAddress?: Address
  /** Payment token to read. Defaults to the legacy mock token for the symbol. */
  paymentTokenAddress?: Address
}): ResultAsync<bigint, Error> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar
  const tokenAddress =
    input.paymentTokenAddress ?? getPaymentTokenAddress(input.selectedToken)
  return fromPromise(
    readContract(input.publicClient, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [input.owner, registrarAddress],
    }),
    (error) => error as Error,
  )
}

/**
 * Read, in one round-trip, the registrar's current allowance on the user's
 * payment token and the live register price. The approval must be for the live
 * price, never the UI quote: the quote was taken when the token was picked,
 * while the registrar pulls the CURRENT price at settlement, so an approval
 * for a stale (lower) quote makes register revert ERC20InsufficientAllowance.
 */
export function readPaymentAuthorizationActor(input: {
  owner: Address
  name: string
  duration: bigint
  selectedToken: TOKEN_SYMBOL
  publicClient: PublicClient
  /** Spender/pricer to read. Defaults to the legacy registrar. */
  registrarAddress?: Address
  /** Payment token to read. Defaults to the legacy mock token for the symbol. */
  paymentTokenAddress?: Address
}): ResultAsync<{ allowance: bigint; livePrice: bigint }, MulticallErrorType> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar
  const tokenAddress =
    input.paymentTokenAddress ?? getPaymentTokenAddress(input.selectedToken)
  const label = input.name.replace('.eth', '')
  return fromPromise(
    (async () => {
      const [allowance, [base, premium]] = await multicall(input.publicClient, {
        allowFailure: false,
        contracts: [
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [input.owner, registrarAddress],
          },
          {
            address: registrarAddress,
            abi: ethRegistrarGetRegisterPriceSnippet,
            functionName: 'getRegisterPrice',
            args: [label, input.duration, tokenAddress],
          },
        ],
      })
      return { allowance, livePrice: base + premium }
    })(),
    (error) => error as MulticallErrorType,
  )
}

/**
 * Verify a name has actually been registered on-chain. Used as a fallback
 * after the submit/poll path fails — if the wallet flaked but the tx
 * landed, the registry will already reflect the new owner + resolver.
 */
export function verifyRegistrationActor(input: {
  name: string
  owner: Address
  resolverAddress: Address
  publicClient: PublicClient
  /** Override for the standalone-HCA registrar; defaults to the EOA deployment. */
  registrarAddress?: Address
}): ResultAsync<{ verified: boolean }, Error> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar
  const cleanName = input.name.replace('.eth', '')
  return fromPromise(
    (async () => {
      // ETHRegistrar.REGISTRY() points at the IPermissionedRegistry where
      // entries are stored. Read the registry, then look up the resolver.
      const registryAddress = (await readContract(input.publicClient, {
        address: registrarAddress,
        abi: parseAbi(['function REGISTRY() view returns (address)']),
        functionName: 'REGISTRY',
      })) as Address

      const registryAbi = parseAbi([
        'function getResolver(string label) view returns (address)',
        'function getOwner(string label) view returns (address)',
      ])
      const [resolver, owner] = await multicall(input.publicClient, {
        allowFailure: false,
        contracts: [
          {
            address: registryAddress,
            abi: registryAbi,
            functionName: 'getResolver',
            args: [cleanName],
          },
          {
            address: registryAddress,
            abi: registryAbi,
            functionName: 'getOwner',
            args: [cleanName],
          },
        ],
      })

      // Guard against the front-running scenario: another address could have
      // claimed the label with the same resolver. Require both resolver and
      // owner to match the expected values.
      const resolverMatches =
        !isAddressEqual(resolver, zeroAddress) &&
        isAddressEqual(resolver, input.resolverAddress)
      const ownerMatches =
        !isAddressEqual(owner, zeroAddress) &&
        isAddressEqual(owner, input.owner)
      const matches = resolverMatches && ownerMatches

      return { verified: matches }
    })(),
    (error) => error as Error,
  )
}

/**
 * Validate commitment readiness before proceeding to registration
 * Checks commitmentAt timestamp and MIN_COMMITMENT_AGE from contract
 * This ensures the commitment is recorded on-chain before registration
 */
export function validateCommitmentActor(input: {
  commitment: CommitmentData
  publicClient: PublicClient
  /** Override for the standalone-HCA registrar; defaults to the EOA deployment. */
  registrarAddress?: Address
}): ResultAsync<void, Error> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return fromPromise(
    (async () => {
      console.log('🔍 [REGISTRATION ACTOR] Validating commitment readiness...')

      // Helper function to sleep
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms))

      // Check MIN_COMMITMENT_AGE from contract
      let minAge: bigint
      try {
        minAge = await readContract(input.publicClient, {
          address: registrarAddress,
          abi: ethRegistrarMinCommitmentAgeSnippet,
          functionName: 'MIN_COMMITMENT_AGE',
        })
        console.log(
          `📋 [REGISTRATION ACTOR] MIN_COMMITMENT_AGE: ${minAge.toString()} seconds`,
        )
      } catch (error) {
        console.warn(
          '⚠️ [REGISTRATION ACTOR] Failed to fetch MIN_COMMITMENT_AGE, assuming 0:',
          error,
        )
        minAge = 0n
      }

      // Check if commitmentAt is recorded (retry with backoff if not)
      let committedAt: bigint = 0n
      let attempts = 0
      const maxAttempts = 5

      while (committedAt === 0n && attempts < maxAttempts) {
        try {
          committedAt = await readContract(input.publicClient, {
            address: registrarAddress,
            abi: ethRegistrarCommitmentsSnippet,
            functionName: 'commitmentAt',
            args: [input.commitment.commitment],
          })

          if (committedAt === 0n) {
            attempts++
            if (attempts < maxAttempts) {
              console.log(
                `⏳ [REGISTRATION ACTOR] Commitment timestamp not yet recorded, waiting 3s (attempt ${attempts}/${maxAttempts})...`,
              )
              await sleep(3000)
            }
          }
        } catch (error) {
          console.warn(
            '⚠️ [REGISTRATION ACTOR] Failed to fetch commitmentAt:',
            error,
          )
          attempts++
          if (attempts < maxAttempts) {
            await sleep(3000)
          }
        }
      }

      if (committedAt === 0n) {
        throw new Error(
          'Commitment timestamp not recorded after multiple attempts. The commitment transaction may not have been confirmed yet.',
        )
      }

      console.log(
        `✅ [REGISTRATION ACTOR] Commitment recorded at timestamp: ${committedAt.toString()}`,
      )

      // If MIN_COMMITMENT_AGE is 0, we can proceed immediately
      if (minAge === 0n) {
        console.log(
          '✅ [REGISTRATION ACTOR] MIN_COMMITMENT_AGE is 0, commitment is ready',
        )
        return
      }

      // Otherwise, wait until MIN_COMMITMENT_AGE has elapsed
      const latestBlock = await getBlock(input.publicClient)
      const nowTs = latestBlock.timestamp as bigint
      const elapsed = nowTs - committedAt

      if (elapsed < minAge) {
        const waitSeconds = Number(minAge - elapsed)
        console.log(
          `⏳ [REGISTRATION ACTOR] Waiting ${waitSeconds}s for MIN_COMMITMENT_AGE before registering...`,
        )
        await sleep(waitSeconds * 1000)
      } else {
        console.log(
          `✅ [REGISTRATION ACTOR] MIN_COMMITMENT_AGE requirement satisfied (elapsed: ${elapsed.toString()}s, required: ${minAge.toString()}s)`,
        )
      }
    })(),
    (error) => {
      console.error(
        '❌ [REGISTRATION ACTOR] Commitment validation failed:',
        error,
      )
      return error as Error
    },
  )
}

/**
 * Submit token approval transaction via transaction manager
 * Note: Normalizes token address to lowercase for Rhinestone SDK compatibility
 */
export function submitApprovalActor(input: {
  tokenPrice: bigint
  selectedToken: TOKEN_SYMBOL
  signer: import('../..').Signer
  publicClient: PublicClient
  id?: string
  /** Spender to approve. Defaults to the legacy registrar. */
  registrarAddress?: Address
  /** Token to approve. Defaults to the legacy mock token for the symbol. */
  paymentTokenAddress?: Address
}): ResultAsync<string, Error> {
  const registrarAddress =
    input.registrarAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return ResultAsync.fromSafePromise(
    Promise.resolve().then(() => {
      const accountAddress = getSignerAddress(input.signer)

      const tokenAddress =
        input.paymentTokenAddress ?? getPaymentTokenAddress(input.selectedToken)
      // Normalize to lowercase to avoid Rhinestone SDK validation issues
      const normalizedTokenAddress = tokenAddress.toLowerCase() as Address
      console.log(
        `🔧 Token address normalization: ${tokenAddress} -> ${normalizedTokenAddress}`,
      )

      // Approve only what this registration needs, never an unlimited allowance.
      const approvalData = encodeTokenApprovalData(
        registrarAddress,
        authorizedPaymentAmount(input.tokenPrice),
      )

      const request = createTransactionRequest({
        signer: input.signer,
        from: accountAddress,
        chainId: input.publicClient.chain?.id ?? sepolia.id,
        calls: [
          {
            to: normalizedTokenAddress,
            data: approvalData,
            value: 0n,
          },
        ],
      })

      const txId = transactionManager.startTransaction(
        {
          type: 'custom',
          request,
        },
        input.signer,
        {
          id: input.id,
          description: `Approve ${input.selectedToken} for registration`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return txId
    }),
  ).mapErr((error) => new Error(`Failed to submit approval: ${error}`))
}

/**
 * Submit registration transaction via transaction manager
 * Note: Normalizes payment token address to lowercase for Rhinestone SDK compatibility
 */
export function submitRegistrationActor(input: {
  name: string
  commitment: CommitmentData
  signer: import('../..').Signer
  duration: bigint
  selectedToken: TOKEN_SYMBOL
  owner: Address
  publicClient: PublicClient
  resolverAddress: Address
  id?: string
}): ResultAsync<string, Error> {
  const registrarAddress = ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return fromPromise(
    (async () => {
      const accountAddress = getSignerAddress(input.signer)

      const paymentToken = getPaymentTokenAddress(input.selectedToken)
      // Normalize to lowercase to avoid Rhinestone SDK validation issues
      const normalizedPaymentToken = paymentToken.toLowerCase() as Address
      console.log(
        `🔧 Payment token normalization: ${paymentToken} -> ${normalizedPaymentToken}`,
      )

      // Validate the token against the registrar's *actual* rent price oracle
      // (see `assertPaymentTokenSupported` for why the registrar itself can't
      // be queried directly).
      await assertPaymentTokenSupported(
        input.publicClient,
        registrarAddress,
        normalizedPaymentToken,
      )

      const registerCall = encodeRegisterCall({
        name: input.name,
        owner: input.owner,
        secret: input.commitment.secret,
        duration: input.duration,
        paymentToken: normalizedPaymentToken,
        resolverAddress: input.resolverAddress,
      })

      const request = createTransactionRequest({
        signer: input.signer,
        from: accountAddress,
        chainId: input.publicClient.chain?.id ?? sepolia.id,
        calls: [registerCall],
      })

      const txId = transactionManager.startTransaction(
        {
          type: 'custom',
          request,
        },
        input.signer,
        {
          id: input.id,
          description: `Register ${input.name}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return txId
    })(),
    (error) => error as Error,
  )
}

/**
 * Poll transaction status by subscribing to transaction machine
 */
export function pollTransactionStatusActor(input: {
  txId: string
}): ResultAsync<void, Error> {
  const txActor = transactionManager.getTransaction(input.txId)

  if (!txActor) {
    return errAsync(new Error(`Transaction ${input.txId} not found`))
  }

  return fromPromise(
    new Promise<void>((resolve, reject) => {
      const subscription = txActor.subscribe((snapshot) => {
        console.log('🔍 [POLL TX STATUS] Transaction state:', {
          txId: input.txId,
          state: snapshot.value,
          hasError: !!snapshot.context.error,
          error: snapshot.context.error?.message,
        })

        if (snapshot.matches('success' as unknown as never)) {
          console.log('✅ [POLL TX STATUS] Transaction succeeded')
          subscription.unsubscribe()
          resolve()
        }
        // Check if we're in any error state (handles nested states like error.submission, error.reverted, etc.)
        if (typeof snapshot.value === 'object' && 'error' in snapshot.value) {
          console.error('❌ [POLL TX STATUS] Transaction failed:', {
            errorState: snapshot.value,
            error: snapshot.context.error,
          })
          subscription.unsubscribe()
          reject(snapshot.context.error || new Error('Transaction failed'))
        }
      })
    }),
    (error) => error as Error,
  )
}

// ============================================================================
// Renewal Actor Functions
// ============================================================================
//
// `ETHRegistrar.renew(label, duration, paymentToken, referrer)` pulls the rent
// from `_msgSender()` (see AbstractETHRegistrar.renew). Crucially, the registrar
// uses HCA-aware sender resolution: when an HCA calls `renew`, `_msgSender()`
// unwraps to the HCA's owner EOA (HCAEquivalence). So the registrar always pulls
// payment from the EOA — never the HCA, which holds no tokens.
//
// This is the same payer the `register` flow authorizes, so renewal reuses the
// exact allowance machinery: read `allowance[EOA][registrar]`, and either skip
// (already enough), sign a gasless EIP-2612 permit batched with `renew` in one
// intent (rhinestone/HCA), or do a plain on-chain `approve` (EOA).

/**
 * Encode `renew(label, duration, paymentToken, referrer)` calldata.
 */
function encodeRenewData(
  label: string,
  duration: bigint,
  paymentToken: Address,
): Hash {
  const cleanLabel = label.replace('.eth', '')
  return encodeFunctionData({
    abi: ethRegistrarRenewSnippet,
    functionName: 'renew',
    args: [cleanLabel, duration, paymentToken, REFERER_ADDRESS],
  })
}

/**
 * Submit a standalone `renew` transaction. Used on the pure-EOA path, where the
 * allowance is set by a preceding on-chain `approve` (or already sufficient).
 * The renewal payer is the EOA — both because the EOA is `msg.sender` here and
 * because the registrar's HCA-aware `_msgSender()` resolves to the EOA anyway.
 */
export function submitRenewActor(input: {
  label: string
  duration: bigint
  selectedToken: TOKEN_SYMBOL
  signer: import('../..').Signer
  publicClient: PublicClient
  renewerAddress?: Address
  id?: string
}): ResultAsync<string, Error> {
  // Renewal is NOT an HCA flow — it is a plain wallet transaction against the
  // selected canonical renewer. V2 callers keep the ETHRegistrar default;
  // unmigrated V1 names explicitly target ETHRenewerV1.
  const chainId = input.publicClient.chain?.id ?? sepolia.id
  const renewerAddress =
    input.renewerAddress ?? ENS_SEPOLIA_CONTRACTS.ETHRegistrar

  return fromPromise(
    (async () => {
      const accountAddress = getSignerAddress(input.signer)

      // The registrar only accepts its own PAYMENT_TOKEN /
      // SECONDARY_PAYMENT_TOKEN; `assertPaymentTokenSupported` below rejects
      // anything else (e.g. DAI) before we spend gas on it.
      const paymentToken = getPaymentTokenAddress(input.selectedToken)
      // Normalize to lowercase to avoid Rhinestone SDK validation issues.
      const normalizedPaymentToken = paymentToken.toLowerCase() as Address

      await assertPaymentTokenSupported(
        input.publicClient,
        renewerAddress,
        normalizedPaymentToken,
      )

      const renewData = encodeRenewData(
        input.label,
        input.duration,
        normalizedPaymentToken,
      )

      const request = createTransactionRequest({
        signer: input.signer,
        from: accountAddress,
        chainId,
        calls: [{ to: renewerAddress, data: renewData, value: 0n }],
      })

      const txId = transactionManager.startTransaction(
        { type: 'custom', request },
        input.signer,
        {
          id: input.id,
          description: `Renew ${input.label}.eth`,
          publicClient: input.publicClient,
          timeout: 120_000,
        },
      )

      return txId
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}
