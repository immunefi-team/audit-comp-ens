/**
 * makeV2Name fixture — registers .eth names on the Anvil Sepolia fork
 * directly via the V2 ETHRegistrar, owned by the Para test account's EOA.
 *
 * Unlike `makeName` (which registers to `user2` for portal tests),
 * this fixture registers to the **Para EOA** so the manager app's
 * profile / primary-name UIs can manage them (the app uses HCA to
 * resolve smart-account → EOA ownership).
 *
 * Each name gets its own dedicated resolver proxy (deployed via
 * VerifiableFactory) initialized with the EOA as owner — matching
 * the app's registration flow.
 *
 * Registration flow:
 *   1. Deploy resolver proxy (VerifiableFactory.deployProxy)
 *   2. Fund the Para EOA with ETH + USDC
 *   3. makeCommitment → commit (signed by EOA)
 *   4. getRegisterPrice → approve USDC → register (signed by EOA)
 */

import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import { setRecords } from '@ensdomains/ensjs/wallet'

import {
  permissionedRegistryGetExpirySnippet,
  permissionedResolverAuthorizeNameRolesSnippet,
  proxyDeployedEventSnippet,
  verifiableFactoryDeployProxySnippet,
} from '@ensdomains/ensjs-abi/v2'
import {
  type Address,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  type Hash,
  http,
  keccak256,
  parseAbi,
  stringToBytes,
  toHex,
  zeroAddress,
  zeroHash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  publicClient,
  testClient,
  walletClient,
} from '../helpers/anvil-client.js'
// ensjs-abi still ships the 2-arg initializer; see the local override.
import { subregistryInitializeSnippet } from '../helpers/permissioned-resolver-abi.js'
import type { Time } from './time.js'

// ---------------------------------------------------------------------------
// Contract addresses (sourced from ensjs Sepolia chain config)
// ---------------------------------------------------------------------------
const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]
const ETH_REGISTRAR = ensjsSepolia.ensEthRegistrar.address
const ETH_REGISTRY = ensjsSepolia.ensRegistry.address
const MOCK_USDC = ensjsSepolia.usdc.address
const PERMISSIONED_RESOLVER_IMPL =
  ensjsSepolia.ensPermissionedResolverImpl.address
const VERIFIABLE_FACTORY = ensjsSepolia.ensVerifiableFactory.address

const REFERRER = zeroHash

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
// getRegisterPrice and MIN_COMMITMENT_AGE are not yet exported by ensjs-abi.
const REGISTRAR_ABI = parseAbi([
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
])

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
])

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum registration duration the contract accepts (28 days). */
const MIN_REGISTRATION_DURATION = 28 * 24 * 60 * 60

/** Full role bitmap — grants all permissions on the resolver. */
const FULL_ROLE_BITMAP = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

/**
 * Standalone HCA of the connected E2E wallet (Anvil account 0, 0xf39F…2266).
 *
 * A VerifiableFactory CREATE2 proxy, so it is derived from the whole account
 * config — factory, implementation, verifiable factory, proxy logic and
 * userSalt(0). It therefore MOVES whenever any of those change in the manifest;
 * it last changed with the 2026-08-10 redeploy (contracts-v2 #409).
 *
 * Hardcoded for the same reason as the addresses in
 * `infra/scripts/print-standalone-hca-addresses.mjs`: the derivation lives in
 * `@ens-apps/smart-account`, which ships un-built `.ts` and is not an e2e
 * dependency. `infra/scripts/fund-rhinestone-account.sh` funds this very
 * address for mockestrator impersonation gas — keep the two in sync.
 */
const STANDALONE_HCA = '0x48B9c6898baFc8A3D3a495BF7c44CF3351486628' as Address

/** Anvil's first default account (has 10 000 ETH — used for minting & funding). */
const ANVIL_FUNDER = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

/**
 * Para test account EOA — the app's registration machine uses
 * `ownerAddress` (the EOA) as the name owner and resolver owner.
 * The smart account calls contracts via HCA, and the resolver
 * resolves msg.sender → EOA via `getAccountOwner()`.
 */
const PARA_EOA_KEY = (process.env.ANVIL_PARA_PRIVATE_KEY ??
  '0x4d1cf5e322e2a7dbfc9e3eccde100ed93167879de7449d18872911ed3a957a81') as `0x${string}`
const PARA_EOA = privateKeyToAccount(PARA_EOA_KEY)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type V2NameConfig = {
  /** The label (without `.eth`). A timestamp suffix is appended for uniqueness. */
  label: string
  /**
   * Duration in seconds.
   *  - Positive: name will expire this many seconds from now.
   *  - Negative: name will have expired |duration| seconds ago
   *    (e.g. -86400 = expired 1 day ago → grace period).
   */
  duration?: number
  /** Optional text records to set on the resolver after registration. */
  records?: { key: string; value: string }[]
  /**
   * Who should own the name:
   * - `'user'` (default): the Para test EOA (authenticated user)
   * - `'other'`: Anvil's first account (not the authenticated user)
   */
  owner?: 'user' | 'other'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForTx(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash })
}

function generateResolverSalt(name: string): bigint {
  const timestamp = new Date().toISOString()
  return BigInt(keccak256(stringToBytes(`${name}:${timestamp}`)))
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type MakeV2NameDependencies = {
  time?: Time
  /**
   * Signing account for the connected "user" (owner: 'user').
   * Defaults to PARA_EOA — pass in the headless wallet's account for
   * non-Para fixtures.
   */
  userAccount?: ReturnType<typeof privateKeyToAccount>
  /**
   * Signing account used when owner: 'other'. Defaults to ANVIL_FUNDER
   * (the first Anvil default account).
   */
  otherAccount?: ReturnType<typeof privateKeyToAccount>
}

export function createMakeV2Name(deps: MakeV2NameDependencies = {}) {
  const resolvedUser = deps.userAccount ?? PARA_EOA
  const resolvedOther = deps.otherAccount ?? ANVIL_FUNDER

  /**
   * Register a V2 .eth name on the anvil fork with a dedicated resolver proxy.
   *
   * If `duration` is negative the name is registered then anvil time is
   * advanced so the name appears expired by |duration| seconds.
   */
  return async function makeV2Name(config: V2NameConfig): Promise<string> {
    const isOther = config.owner === 'other'
    const ownerAddress = isOther ? resolvedOther.address : resolvedUser.address
    const ownerAccount = isOther ? resolvedOther : resolvedUser
    const timestamp = Math.floor(Date.now() / 1000)
    const uniqueLabel = `${config.label}-${timestamp}`

    const requestedDuration = config.duration ?? MIN_REGISTRATION_DURATION
    let registrationDuration: number
    /** Seconds past expiry the name should be (0 = not expired). */
    let desiredGapPastExpiry = 0

    if (requestedDuration < 0) {
      registrationDuration = MIN_REGISTRATION_DURATION
      desiredGapPastExpiry = Math.abs(requestedDuration)
    } else {
      registrationDuration = Math.max(
        requestedDuration,
        MIN_REGISTRATION_DURATION,
      )
    }

    const secret = keccak256(toHex(`v2-${uniqueLabel}:${Math.random()}`))

    console.log(
      `[makeV2Name] registering ${uniqueLabel}.eth → ${ownerAddress} (duration=${registrationDuration}s, gap=${desiredGapPastExpiry}s)`,
    )

    // ── 0. Clear any contract code at owner address ───────────────────
    // Well-known Anvil accounts (e.g. 0xf39F…2266) have EOF contracts
    // deployed on Sepolia, which breaks ERC1155 _safeMint. Setting the
    // code to 0x makes the address an EOA on the fork.
    await testClient.setCode({ address: ownerAddress, bytecode: '0x' })

    // ── 1. Deploy dedicated resolver proxy ──────────────────────────
    // Initialized with the EOA as owner — matches the app's flow where
    // the resolver checks HCA ownership (smart account → EOA).
    const resolverAddress = await deployResolverProxy(uniqueLabel, ownerAddress)
    console.log(`[makeV2Name] resolver proxy: ${resolverAddress}`)

    // Mirror the grant the app's own registration performs. There, the resolver
    // is initialized with the HCA as admin (`initialize(hca, ROLES_ALL, [])`)
    // and the wallet is granted roles afterwards; here the EOA is admin, so we
    // grant the HCA instead. Either way BOTH end up holding the root roles.
    //
    // Without it, record edits — which execute AS the HCA, since the manager
    // signs them with the smart account — revert:
    //   EACUnauthorizedAccountRoles(resource, 0x10, <hca>)
    //
    // Skipped for `owner: 'other'`: the connected user's HCA must not be able
    // to write records on a name somebody else owns.
    if (!isOther) {
      await authorizeHcaOnResolver(resolverAddress, ownerAccount)
      console.log(
        `[makeV2Name] granted resolver roles to HCA ${STANDALONE_HCA}`,
      )
    }

    // ── 2. Fund the EOA ─────────────────────────────────────────────
    const balance = await publicClient.getBalance({ address: ownerAddress })
    if (balance < 10000000000000000n) {
      // < 0.01 ETH
      const fundTx = await walletClient.sendTransaction({
        account: ANVIL_FUNDER,
        to: ownerAddress,
        value: 100000000000000000n, // 0.1 ETH
      })
      await waitForTx(fundTx)
    }

    // Mint USDC to the EOA
    const mintData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [ownerAddress, BigInt(10_000_000_000)], // 10 000 USDC
    })
    const mintTx = await walletClient.sendTransaction({
      account: ANVIL_FUNDER,
      to: MOCK_USDC,
      data: mintData,
    })
    await waitForTx(mintTx)

    // ── 3. Make commitment ──────────────────────────────────────────
    const commitment = await publicClient.readContract({
      address: ETH_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: 'makeCommitment',
      args: [
        uniqueLabel,
        ownerAddress,
        secret,
        zeroAddress,
        resolverAddress,
        BigInt(registrationDuration),
        REFERRER,
      ],
    })

    // ── 4. Submit commitment ────────────────────────────────────────
    const commitData = encodeFunctionData({
      abi: REGISTRAR_ABI,
      functionName: 'commit',
      args: [commitment],
    })
    const commitTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: ETH_REGISTRAR,
      data: commitData,
    })
    await waitForTx(commitTx)

    // ── 5. Wait for MIN_COMMITMENT_AGE (60s on production ETHRegistrar) ──
    let minAge = 0n
    try {
      minAge = await publicClient.readContract({
        address: ETH_REGISTRAR,
        abi: REGISTRAR_ABI,
        functionName: 'MIN_COMMITMENT_AGE',
      })
    } catch {
      // Default to 0
    }

    if (minAge > 0n) {
      const waitSec = Number(minAge) + 1
      console.log(
        `[makeV2Name] advancing time ${waitSec}s for MIN_COMMITMENT_AGE`,
      )
      await testClient.increaseTime({ seconds: waitSec })
      await testClient.mine({ blocks: 1 })
    }

    // ── 6. Get register price ────────────────────────────────────────
    const [base, premium] = await publicClient.readContract({
      address: ETH_REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: 'getRegisterPrice',
      args: [uniqueLabel, BigInt(registrationDuration), MOCK_USDC],
    })
    const totalPrice = base + premium

    // ── 7. Approve USDC ─────────────────────────────────────────────
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ETH_REGISTRAR, totalPrice * 2n],
    })
    const approveTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: MOCK_USDC,
      data: approveData,
    })
    await waitForTx(approveTx)

    // ── 8. Register ─────────────────────────────────────────────────
    const registerData = encodeFunctionData({
      abi: REGISTRAR_ABI,
      functionName: 'register',
      args: [
        uniqueLabel,
        ownerAddress,
        secret,
        zeroAddress,
        resolverAddress,
        BigInt(registrationDuration),
        MOCK_USDC,
        REFERRER,
      ],
    })
    const registerTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: ETH_REGISTRAR,
      data: registerData,
    })
    await waitForTx(registerTx)

    const ethName = `${uniqueLabel}.eth`

    // ── 9. Set text records via PermissionedResolver multicall ───────
    const records = config.records ?? []
    if (records.length > 0) {
      const ownerClient = createWalletClient({
        account: ownerAccount,
        chain: walletClient.chain!,
        transport: http(process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'),
      })
      await waitForTx(
        await setRecords(ownerClient, {
          name: ethName,
          resolverAddress,
          texts: records,
        }),
      )
      console.log(`[makeV2Name] set ${records.length} record(s) on ${ethName}`)
    }

    console.log(`[makeV2Name] ✅ registered ${ethName}`)

    // ── 10. Fast-forward to exact target timestamp if needed ─────────
    if (desiredGapPastExpiry > 0) {
      const labelHash = BigInt(keccak256(toHex(uniqueLabel)))
      const expiry = await publicClient.readContract({
        address: ETH_REGISTRY,
        abi: permissionedRegistryGetExpirySnippet,
        functionName: 'getExpiry',
        args: [labelHash],
      })
      const targetTimestamp = Number(expiry) + desiredGapPastExpiry
      console.log(
        `[makeV2Name] name expiry=${expiry}, target block.timestamp=${targetTimestamp} (${desiredGapPastExpiry}s past expiry)`,
      )
      await testClient.setNextBlockTimestamp({
        timestamp: BigInt(targetTimestamp),
      })
      await testClient.mine({ blocks: 1 })
    }

    // Sync browser clock if time fixture is available
    if (deps.time) {
      await deps.time.sync()
    }

    return ethName
  }
}

// ---------------------------------------------------------------------------
// Resolver deployment helper
// ---------------------------------------------------------------------------

/**
 * Deploy a dedicated resolver proxy via VerifiableFactory, initialized
 * with `owner` having full permissions. Anyone can call deployProxy,
 * so we use ANVIL_FUNDER (no impersonation needed here).
 */
/**
 * Grant the connected wallet's standalone HCA the root roles on `resolver`.
 *
 * Sent by `admin`, the account `initialize` made resolver admin, so it is the
 * one allowed to hand out roles. `toName` is `0x00` — the resolver's own root
 * resource — matching `authorizeNameRoles` in the app's registration batch.
 */
async function authorizeHcaOnResolver(
  resolver: Address,
  admin: ReturnType<typeof privateKeyToAccount>,
): Promise<void> {
  const data = encodeFunctionData({
    abi: permissionedResolverAuthorizeNameRolesSnippet,
    functionName: 'authorizeNameRoles',
    args: ['0x00', FULL_ROLE_BITMAP, STANDALONE_HCA, true],
  })

  const tx = await walletClient.sendTransaction({
    account: admin,
    to: resolver,
    data,
  })
  await waitForTx(tx)
}

async function deployResolverProxy(
  nameLabel: string,
  owner: Address,
): Promise<Address> {
  const salt = generateResolverSalt(nameLabel)
  const initCalldata = encodeFunctionData({
    abi: subregistryInitializeSnippet,
    functionName: 'initialize',
    args: [owner, FULL_ROLE_BITMAP, []],
  })

  const deployData = encodeFunctionData({
    abi: verifiableFactoryDeployProxySnippet,
    functionName: 'deployProxy',
    args: [PERMISSIONED_RESOLVER_IMPL, salt, initCalldata],
  })

  const deployTx = await walletClient.sendTransaction({
    account: ANVIL_FUNDER,
    to: VERIFIABLE_FACTORY,
    data: deployData,
  })
  const receipt = await waitForTx(deployTx)

  // Extract the deployed proxy address from the ProxyDeployed event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: proxyDeployedEventSnippet,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'ProxyDeployed') {
        return (decoded.args as { proxyAddress: Address }).proxyAddress
      }
    } catch {
      // Ignore non-matching logs
    }
  }

  throw new Error(
    `[makeV2Name] ProxyDeployed event not found in resolver deployment receipt`,
  )
}
