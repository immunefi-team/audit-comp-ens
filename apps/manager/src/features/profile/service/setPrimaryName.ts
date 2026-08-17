import {
  type Call,
  ENS_SEPOLIA_CONTRACTS,
  getSmartAccountAddress,
  planHcaIntentFunding,
  type RhinestoneSigner,
  type RhinestoneTransactionRequest,
  type Signer,
  type TransactionRequest,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import {
  defaultReverseRegistrarSetNameSnippet,
  reverseRegistrarSetNameSnippet,
} from '@ensdomains/ensjs/contracts'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  isAddressEqual,
  namehash,
  type PublicClient,
  parseAbi,
  type WalletClient,
  zeroAddress,
} from 'viem'
import { normalize } from 'viem/ens'

export interface SetPrimaryNameParams {
  /** ENS name, with or without the `.eth` suffix */
  name: string
  /**
   * The EOA that claims the primary name. The reverse registrars key
   * `setName` on `msg.sender`, so this EOA sends both transactions itself.
   */
  ownerAddress: Address
  /** Wallet client for the owner EOA; signs and sends both transactions. */
  walletClient: WalletClient
  publicClient: PublicClient
  chainId: number
  /** Called with each submitted txId so the UI can track it via a selector */
  onTxId?: (txId: string) => void
}

// Normalized claim string: a non-canonical name would fail the bidirectional
// check at resolution time and read as "no primary name".
const withEthSuffix = (name: string) =>
  normalize(name.endsWith('.eth') ? name : `${name}.eth`)

const reverseAdapterAbi = parseAbi([
  'function setNameWithHCA(address addr, string name)',
  'function claimWithHCA(address addr, address resolver) returns (bytes32)',
  // `claim` is the non-HCA sibling of `claimWithHCA`: it authorizes through
  // `AccountNamerLib.requireNamer(account, msg.sender)`, which passes on
  // `account == msg.sender`. So the owner EOA can clear its own
  // `addr.reverse` directly, with no HCA and no intent.
  'function claim(address addr, address resolver) returns (bytes32)',
])

const registryResolverAbi = parseAbi([
  'function resolver(bytes32 node) view returns (address)',
])

/** v1 reverse node for an address: namehash of `<hex-addr>.addr.reverse`. */
export const addrReverseNode = (address: Address): Hex =>
  namehash(`${address.slice(2).toLowerCase()}.addr.reverse`)

/**
 * Whether the owner has a live `addr.reverse` entry that would shadow a
 * `default.reverse` claim.
 *
 * `addr.reverse` is chain-specific and takes precedence over the
 * chain-agnostic `default.reverse` (ENSIP-19), so a leftover entry makes a
 * fresh default claim invisible. Worse, it does not merely lose — if the old
 * name no longer resolves forward, the UniversalResolver *reverts*
 * (`ResolverNotFound`) instead of falling through, and the address reads as
 * having no primary name at all.
 *
 * Presence of a resolver on the node is the test, because that is exactly what
 * the resolver-lookup step of reverse resolution keys on: clearing it is what
 * lets resolution fall through to `default.reverse`.
 */
export async function hasStaleAddrReverse(input: {
  publicClient: PublicClient
  ownerAddress: Address
}): Promise<boolean> {
  const resolver = await input.publicClient.readContract({
    address: ENS_SEPOLIA_CONTRACTS.LegacyRegistry,
    abi: registryResolverAbi,
    functionName: 'resolver',
    args: [addrReverseNode(input.ownerAddress)],
  })

  return resolver !== zeroAddress
}

export interface SetPrimaryNameWithHcaParams {
  /** ENS name, with or without the `.eth` suffix */
  name: string
  /** The rhinestone signer from the smart-account context. */
  signer: RhinestoneSigner
  /** The owner EOA the primary name is claimed for. */
  ownerAddress: Address
  /**
   * Owner wallet client. Signs the intent, and the EIP-2612 funding permit
   * when the HCA cannot cover its own fee.
   */
  walletClient: WalletClient
  publicClient: PublicClient
  chainId: number
  /** Called with the submitted txId so the UI can track it via a selector */
  onTxId?: (txId: string) => void
}

/**
 * Set a primary name through the HCA in one owner-signed intent:
 * `DefaultReverseRegistrarAdapter.setNameWithHCA` writes `default.reverse`,
 * and when the owner has a live `addr.reverse` entry (which would shadow the
 * default), `ReverseRegistrarAdapter.claimWithHCA(owner, 0)` clears it so
 * resolution falls back to the fresh default claim.
 *
 * User-paid in USDC like every other intent on this route — NOT sponsored. The
 * HCA is left near-empty by registration (the budget carries no buffer), so
 * `planHcaIntentFunding` quotes the fee and pulls the shortfall in from the
 * owner's wallet inside this same intent.
 */
export async function setPrimaryNameWithHca(
  params: SetPrimaryNameWithHcaParams,
): Promise<void> {
  const {
    name,
    signer,
    ownerAddress,
    walletClient,
    publicClient,
    chainId,
    onTxId,
  } = params
  const cleanName = withEthSuffix(name)

  if (
    !walletClient.account ||
    !isAddressEqual(walletClient.account.address, ownerAddress)
  ) {
    throw new Error(
      'Cannot set primary name - the connected wallet does not control the owner address.',
    )
  }

  const clearsStaleAddrReverse = await hasStaleAddrReverse({
    publicClient,
    ownerAddress,
  })

  const calls: readonly Call[] = [
    {
      to: ENS_SEPOLIA_CONTRACTS.DefaultReverseRegistrarAdapter,
      value: 0n,
      data: encodeFunctionData({
        abi: reverseAdapterAbi,
        functionName: 'setNameWithHCA',
        args: [ownerAddress, cleanName],
      }),
    },
    ...(clearsStaleAddrReverse
      ? [
          {
            to: ENS_SEPOLIA_CONTRACTS.ReverseRegistrarAdapter,
            value: 0n,
            data: encodeFunctionData({
              abi: reverseAdapterAbi,
              functionName: 'claimWithHCA',
              args: [ownerAddress, zeroAddress],
            }),
          },
        ]
      : []),
  ]

  // Owner-signed on purpose: changing the primary identity warrants an
  // explicit wallet approval, and it keeps the claim leg independent of the
  // session's action allowlist — `claimWithHCA` is NOT one of the five targets
  // `HCAOwnerAndSessionValidator` allows a session to call, so a session-signed
  // version of this batch would revert `ActionNotAllowed`. The owner-signed
  // path takes the 65-byte ECDSA branch in `isValidSignatureWithSender`, which
  // applies no action policy at all — which is also what makes the funding
  // permit legal here, unlike inside the session-signed commit leg.
  const ownerSigner: RhinestoneSigner = { ...signer, session: undefined }

  const funding = await planHcaIntentFunding({
    signer: ownerSigner,
    ownerAddress,
    approvalSigner: { type: 'eoa', walletClient },
    publicClient,
    chainId,
    calls,
  })

  const request: RhinestoneTransactionRequest = {
    type: 'rhinestone-intent',
    from: getSmartAccountAddress(signer),
    chainId,
    rhinestoneParams: {
      calls: funding.calls,
      // User-paid in USDC, like every intent on this route.
      feeAsset: 'USDC',
      ...(funding.auxiliaryFunds
        ? { auxiliaryFunds: funding.auxiliaryFunds }
        : {}),
    },
  }

  const txId = transactionManager.startTransaction(
    { type: 'custom', request },
    ownerSigner,
    {
      description: `Set primary name to ${cleanName}`,
      publicClient,
      chainId,
      operation: 'set-primary-name',
      name: cleanName,
    },
  )
  onTxId?.(txId)
  await waitForTransaction(txId)
}

/** EOA forward leg: setName on the default reverse registrar. */
export function submitPrimaryNameForward(input: {
  name: string
  signer: Signer
  accountAddress: Address
  publicClient: PublicClient
  chainId: number
}): string {
  const cleanName = withEthSuffix(input.name)
  const data = encodeFunctionData({
    abi: defaultReverseRegistrarSetNameSnippet,
    functionName: 'setName',
    args: [cleanName],
  })

  const request: TransactionRequest = {
    type: 'eoa',
    from: input.accountAddress,
    to: ENS_SEPOLIA_CONTRACTS.DefaultReverseRegistrar,
    data,
    value: 0n,
    chainId: input.chainId,
  }

  return transactionManager.startTransaction(
    { type: 'custom', request },
    input.signer,
    {
      description: `Set primary name to ${cleanName}`,
      publicClient: input.publicClient,
      chainId: input.chainId,
      operation: 'set-primary-name',
      name: cleanName,
    },
  )
}

/**
 * Clears a shadowing `addr.reverse` entry so a `default.reverse` claim can be
 * seen, as a plain owner-EOA transaction (~45k gas, no USDC, no intent).
 *
 * This exists because the HCA reveal batch *cannot* do it. The batch is
 * session-signed, and `HCAOwnerAndSessionValidator` allowlists call targets as
 * immutables: it carries `DEFAULT_REVERSE_REGISTRAR_HCA_ADAPTER` but has no
 * counterpart for the `addr.reverse` adapter, so a session-signed
 * `claimWithHCA` reverts `ActionNotAllowed`. Until the validator gains that
 * target, the cleanup has to be a separate owner-signed transaction.
 *
 * Passing `resolver = 0` clears the resolver rather than writing a new name:
 * we are not claiming `addr.reverse` for the new name, only getting it out of
 * the way of `default.reverse`.
 */
export function submitClearAddrReverse(input: {
  signer: Signer
  ownerAddress: Address
  publicClient: PublicClient
  chainId: number
}): string {
  const data = encodeFunctionData({
    abi: reverseAdapterAbi,
    functionName: 'claim',
    args: [input.ownerAddress, zeroAddress],
  })

  const request: TransactionRequest = {
    type: 'eoa',
    from: input.ownerAddress,
    to: ENS_SEPOLIA_CONTRACTS.ReverseRegistrarAdapter,
    data,
    value: 0n,
    chainId: input.chainId,
  }

  return transactionManager.startTransaction(
    { type: 'custom', request },
    input.signer,
    {
      description: 'Clear outdated primary name record',
      publicClient: input.publicClient,
      chainId: input.chainId,
      operation: 'set-primary-name',
    },
  )
}

/** EOA reverse leg: setName on the reverse registrar. */
export function submitPrimaryNameReverse(input: {
  name: string
  signer: Signer
  accountAddress: Address
  publicClient: PublicClient
  chainId: number
}): string {
  const cleanName = withEthSuffix(input.name)
  const data = encodeFunctionData({
    abi: reverseRegistrarSetNameSnippet,
    functionName: 'setName',
    args: [cleanName],
  })

  const request: TransactionRequest = {
    type: 'eoa',
    from: input.accountAddress,
    to: ENS_SEPOLIA_CONTRACTS.ReverseRegistrar,
    data,
    value: 0n,
    chainId: input.chainId,
  }

  return transactionManager.startTransaction(
    { type: 'custom', request },
    input.signer,
    {
      description: `Set addr.reverse for ${cleanName}`,
      publicClient: input.publicClient,
      chainId: input.chainId,
      operation: 'set-primary-name',
      name: cleanName,
    },
  )
}

/**
 * EOA fallback (USE_EOA / no smart account): the owner sends two sequential
 * gas-paying transactions. HCA accounts use `setPrimaryNameWithHca` instead.
 */
export async function setPrimaryName(
  params: SetPrimaryNameParams,
): Promise<void> {
  const { name, ownerAddress, walletClient, publicClient, chainId, onTxId } =
    params

  // The wallet client and the owner address come from the account context
  // separately and can momentarily diverge while the wallet reconnects or the
  // user switches accounts. Require a bound account that matches the owner:
  // an account-less client gives no way to verify the wallet controls the
  // owner address, and a mismatched one would fail at the wallet.
  if (
    !walletClient.account ||
    !isAddressEqual(walletClient.account.address, ownerAddress)
  ) {
    throw new Error(
      'Cannot set primary name - the connected wallet does not control the owner address.',
    )
  }

  const signer: Signer = { type: 'eoa', walletClient }

  const forwardTxId = submitPrimaryNameForward({
    name,
    signer,
    accountAddress: ownerAddress,
    publicClient,
    chainId,
  })
  onTxId?.(forwardTxId)
  await waitForTransaction(forwardTxId)

  const reverseTxId = submitPrimaryNameReverse({
    name,
    signer,
    accountAddress: ownerAddress,
    publicClient,
    chainId,
  })
  onTxId?.(reverseTxId)
  await waitForTransaction(reverseTxId)
}
