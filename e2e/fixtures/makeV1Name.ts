/**
 * makeV1Name fixture — registers .eth names on the Anvil Sepolia fork
 * using the V1 ETHRegistrarController (unwrapped controller).
 *
 * V1 registration differs from V2:
 *   - Payment is in ETH (msg.value), not ERC-20 tokens
 *   - Uses struct-based ABI: (name, owner, duration, secret, resolver, data[], reverseRecord, referral)
 *   - Creates an unwrapped ERC-721 token on the BaseRegistrar
 *   - Has a 60-second minCommitmentAge (requires time advancement)
 *
 * After each V1 registration, reserveInV2() creates the RESERVED placeholder
 * in the V2 ETH Registry. Migration controllers only hold ROLE_REGISTER_RESERVED —
 * they cannot register AVAILABLE names. Without this step, MigrationHelper.migrate()
 * reverts when the migration controller tries to claim the V2 slot.
 *
 * The registered name is owned by the specified account's EOA address.
 */
import {
  type Address,
  encodeFunctionData,
  type Hash,
  keccak256,
  namehash,
  parseAbi,
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

// ---------------------------------------------------------------------------
// V1 Contract addresses (Sepolia fork)
// ---------------------------------------------------------------------------
const V1_ETH_REGISTRAR_CONTROLLER =
  '0xF42dF26c1b222bee5a6B78cBB8bbfaa0Ba07786a' as const
export const V1_BASE_REGISTRAR =
  '0x6409609247722761b8ba96371485de92a6d7b83b' as Address
export const V1_NAME_WRAPPER =
  '0xc7e033b8836e4bd55d069d113f018b98478cb091' as Address
export const V1_PUBLIC_RESOLVER =
  '0x640294a2b2d87e7f522db3e3e3e876764bce170d' as Address
export const V1_ENS_REGISTRY =
  '0x7e89b563f936c68c31a360840eb7f9a4aacaf014' as Address

// ---------------------------------------------------------------------------
// V2 Contract addresses — used by reserveInV2()
// ---------------------------------------------------------------------------
// ETH Registry (PermissionedRegistry for .eth)
const V2_ETH_REGISTRY = '0x796fff2e907449be8d5921bcc215b1b76d89d080' as Address
// ETH Registrar — has ROLE_REGISTRAR on V2_ETH_REGISTRY (baked by bake-contracts.py)
// We impersonate it to create RESERVED entries for dynamically-created test names.
const V2_ETH_REGISTRAR = '0x68586418353b771cf2425ed14a07512aa880c532' as Address

// ---------------------------------------------------------------------------
// ABIs — struct-based V1 controller
// ---------------------------------------------------------------------------
const V1_CONTROLLER_ABI = parseAbi([
  'function makeCommitment((string,address,uint256,bytes32,address,bytes[],uint8,bytes32)) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register((string,address,uint256,bytes32,address,bytes[],uint8,bytes32)) payable',
  'function rentPrice(string name, uint256 duration) view returns (uint256)',
  'function minCommitmentAge() view returns (uint256)',
  'function available(string name) view returns (bool)',
])

const BASE_REGISTRAR_ABI = parseAbi([
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function nameExpires(uint256 id) view returns (uint256)',
])

const NAME_WRAPPER_ABI = parseAbi([
  'function wrapETH2LD(string label, address wrappedOwner, uint16 ownerControlledFuses, address resolver)',
  'function isWrapped(bytes32 node) view returns (bool)',
])

const ENS_REGISTRY_ABI = parseAbi([
  'function setResolver(bytes32 node, address resolver)',
  'function resolver(bytes32 node) view returns (address)',
])

const RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function setAddr(bytes32 node, uint256 coinType, bytes a)',
  'function text(bytes32 node, string key) view returns (string)',
])

// PermissionedRegistry.register() — creates AVAILABLE→RESERVED when owner=0.
// Caller must have ROLE_REGISTRAR on the root resource (we impersonate ETH_REGISTRAR).
const V2_ETH_REGISTRY_ABI = parseAbi([
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)',
])

// ---------------------------------------------------------------------------
// Fuse constants (NameWrapper owner-controlled fuses, bits 0-6)
// ---------------------------------------------------------------------------
export const FUSES = {
  CANNOT_UNWRAP: 1,
  CANNOT_BURN_FUSES: 2,
  CANNOT_TRANSFER: 4,
  CANNOT_SET_RESOLVER: 8,
  CANNOT_SET_TTL: 16,
  CANNOT_CREATE_SUBDOMAIN: 32,
  CANNOT_APPROVE: 64,
  CAN_EXTEND_EXPIRY: 1 << 18, // parent-controlled, but setChildFuses can set on child
} as const

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_DURATION = 365 * 24 * 60 * 60

const ANVIL_FUNDER = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

const PARA_EOA_KEY = (process.env.ANVIL_PARA_PRIVATE_KEY ??
  '0x4d1cf5e322e2a7dbfc9e3eccde100ed93167879de7449d18872911ed3a957a81') as `0x${string}`
const PARA_EOA = privateKeyToAccount(PARA_EOA_KEY)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type V1NameType = 'unwrapped' | 'wrapped' | 'locked'

export type V1TextRecord = { key: string; value: string }
export type V1AddressRecord = { coinType: number; value: `0x${string}` }

export type V1NameConfig = {
  /** The label (without `.eth`). A timestamp suffix is appended for uniqueness. */
  label: string
  /**
   * Duration in seconds. Positive = future expiry from now. Negative = the
   * name will be expired by `|duration|` seconds at test time (time is
   * advanced after reservation so the V2 RESERVED slot has a past expiry —
   * useful for testing grace-period UI and renewal flows, NOT migration
   * itself which requires ROLE_REGISTRAR for expired slots).
   *
   * Default: 1 year.
   */
  duration?: number
  /** Owner user key (default: 'user'). Maps to an Anvil mnemonic account. */
  owner?: string
  /**
   * Type of V1 name to create:
   * - `unwrapped` (default): ERC-721 on BaseRegistrar only
   * - `wrapped`: wrapped in NameWrapper with zero owner-controlled fuses (unlocked)
   * - `locked`: wrapped in NameWrapper with at least CANNOT_UNWRAP set
   */
  type?: V1NameType
  /**
   * Additional owner-controlled fuses bitmap (uint16).
   * - For `locked` type: OR'd with CANNOT_UNWRAP (e.g. `FUSES.CANNOT_BURN_FUSES | FUSES.CANNOT_TRANSFER`)
   * - For `wrapped` type: sets fuses directly (CANNOT_UNWRAP is NOT forced)
   * - For `unwrapped` type: ignored
   */
  fuses?: number
  /**
   * V1 records to set on the name after registration.
   */
  records?: {
    texts?: V1TextRecord[]
    addresses?: V1AddressRecord[]
  }
}

// ---------------------------------------------------------------------------
// reserveInV2 — creates the RESERVED placeholder in V2 ETH Registry
// ---------------------------------------------------------------------------

/**
 * Create a RESERVED entry in the V2 ETH Registry for a V1 name.
 *
 * Migration controllers have ROLE_REGISTER_RESERVED (not ROLE_REGISTRAR), so
 * they can only migrate names that are already RESERVED in V2. For dynamically-
 * created test names that don't exist in the premigration snapshot, we must call
 * this manually by impersonating the ETH_REGISTRAR (which has ROLE_REGISTRAR).
 *
 * Silently succeeds if the slot is already RESERVED (idempotent guard).
 */
export async function reserveInV2(
  label: string,
  v1Expiry: bigint,
): Promise<void> {
  console.log(`[reserveInV2] reserving ${label}.eth in V2 (expiry=${v1Expiry})`)

  await testClient.impersonateAccount({ address: V2_ETH_REGISTRAR })
  try {
    const hash = await walletClient.sendTransaction({
      account: V2_ETH_REGISTRAR,
      to: V2_ETH_REGISTRY,
      data: encodeFunctionData({
        abi: V2_ETH_REGISTRY_ABI,
        functionName: 'register',
        args: [
          label,
          zeroAddress, // owner = 0 → creates RESERVED (not REGISTERED)
          zeroAddress, // no subregistry yet
          V1_PUBLIC_RESOLVER, // fallback resolver for resolution during unmigrated state
          0n, // roleBitmap must be 0 when owner is zero
          v1Expiry, // sync V1 expiry into V2
        ],
      }),
    })
    await waitForTx(hash)
    console.log(`[reserveInV2] ✅ ${label}.eth RESERVED in V2`)
  } catch (err: unknown) {
    // LabelAlreadyReserved → already RESERVED, nothing to do
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('LabelAlreadyReserved') || msg.includes('0x')) {
      console.log(`[reserveInV2] ${label}.eth already RESERVED, skipping`)
    } else {
      throw err
    }
  } finally {
    await testClient.stopImpersonatingAccount({ address: V2_ETH_REGISTRAR })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function waitForTx(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash })
}

type RegistrationStruct = readonly [
  string,
  Address,
  bigint,
  `0x${string}`,
  Address,
  readonly `0x${string}`[],
  number,
  `0x${string}`,
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
type MakeV1NameDependencies = {
  userAccount?: ReturnType<typeof privateKeyToAccount>
}

export function createMakeV1Name(deps: MakeV1NameDependencies = {}) {
  const resolvedUser = deps.userAccount ?? PARA_EOA

  return async function makeV1Name(config: V1NameConfig): Promise<string> {
    const ownerAddress = resolvedUser.address
    const ownerAccount = resolvedUser
    const timestamp = Math.floor(Date.now() / 1000)
    const uniqueLabel = `${config.label}-${timestamp}`
    const absDuration = Math.abs(config.duration ?? DEFAULT_DURATION)
    const isNegativeDuration = (config.duration ?? DEFAULT_DURATION) < 0
    const duration = BigInt(absDuration)
    const secret = keccak256(toHex(`v1-${uniqueLabel}:${Math.random()}`))

    console.log(
      `[makeV1Name] registering V1 name ${uniqueLabel}.eth (duration=${duration}s, type=${config.type ?? 'unwrapped'})`,
    )

    // ── 0. Fund owner if needed ────────────────────────────────────
    const balance = await publicClient.getBalance({ address: ownerAddress })
    if (balance < 10000000000000000n) {
      const fundTx = await walletClient.sendTransaction({
        account: ANVIL_FUNDER,
        to: ownerAddress,
        value: 100000000000000000n,
      })
      await waitForTx(fundTx)
    }

    const regStruct: RegistrationStruct = [
      uniqueLabel,
      ownerAddress,
      duration,
      secret,
      zeroAddress,
      [],
      0,
      zeroHash as `0x${string}`,
    ]

    // ── 1. Commit ──────────────────────────────────────────────────
    const commitment = await publicClient.readContract({
      address: V1_ETH_REGISTRAR_CONTROLLER,
      abi: V1_CONTROLLER_ABI,
      functionName: 'makeCommitment',
      args: [regStruct],
    })

    const commitTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_ETH_REGISTRAR_CONTROLLER,
      data: encodeFunctionData({
        abi: V1_CONTROLLER_ABI,
        functionName: 'commit',
        args: [commitment],
      }),
    })
    await waitForTx(commitTx)

    // ── 2. Wait for minCommitmentAge ───────────────────────────────
    let minAge = 0n
    try {
      minAge = await publicClient.readContract({
        address: V1_ETH_REGISTRAR_CONTROLLER,
        abi: V1_CONTROLLER_ABI,
        functionName: 'minCommitmentAge',
      })
    } catch {
      /* default 0 */
    }

    if (minAge > 0n) {
      await testClient.increaseTime({ seconds: Number(minAge) + 1 })
      await testClient.mine({ blocks: 1 })
    }

    // ── 3. Register ────────────────────────────────────────────────
    const price = await publicClient.readContract({
      address: V1_ETH_REGISTRAR_CONTROLLER,
      abi: V1_CONTROLLER_ABI,
      functionName: 'rentPrice',
      args: [uniqueLabel, duration],
    })

    const registerTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_ETH_REGISTRAR_CONTROLLER,
      data: encodeFunctionData({
        abi: V1_CONTROLLER_ABI,
        functionName: 'register',
        args: [regStruct],
      }),
      value: (price * 110n) / 100n,
    })
    await waitForTx(registerTx)

    // ── 4. Read V1 expiry from BaseRegistrar ───────────────────────
    const tokenId = BigInt(keccak256(toHex(uniqueLabel)))
    const v1Expiry = await publicClient.readContract({
      address: V1_BASE_REGISTRAR,
      abi: BASE_REGISTRAR_ABI,
      functionName: 'nameExpires',
      args: [tokenId],
    })

    // ── 5. Reserve in V2 BEFORE any time advancement ───────────────
    // The reservation must be created while v1Expiry is still in the future
    // so the V2 slot gets the correct active expiry.
    await reserveInV2(uniqueLabel, v1Expiry)

    // ── 6. Wrap if requested ────────────────────────────────────────
    const nameType = config.type ?? 'unwrapped'
    if (nameType === 'wrapped' || nameType === 'locked') {
      await wrapName(
        uniqueLabel,
        ownerAddress,
        ownerAccount,
        nameType,
        config.fuses,
      )
    }

    // ── 7. Set V1 records if provided ──────────────────────────────
    if (config.records) {
      await setV1Records(uniqueLabel, ownerAccount, nameType, config.records)
    }

    // ── 8. Advance time for negative-duration scenario ─────────────
    // Done LAST so wrapping and records use an active timestamp.
    // Note: names with a past V2 reservation expiry are AVAILABLE in V2
    // (not RESERVED), so migration controllers cannot claim them — these
    // scenarios are for testing expired-name UI and renewal flows, not migration.
    if (isNegativeDuration) {
      const overageSeconds = absDuration + 1
      console.log(
        `[makeV1Name] advancing time ${overageSeconds}s to put ${uniqueLabel}.eth past expiry`,
      )
      await testClient.increaseTime({ seconds: overageSeconds })
      await testClient.mine({ blocks: 1 })
    }

    const ethName = `${uniqueLabel}.eth`
    console.log(
      `[makeV1Name] ✅ ${ethName} (type: ${nameType}, owner: ${ownerAddress})`,
    )
    return ethName
  }
}

// ---------------------------------------------------------------------------
// Wrapping helper
// ---------------------------------------------------------------------------
async function wrapName(
  label: string,
  ownerAddress: Address,
  ownerAccount: ReturnType<typeof privateKeyToAccount>,
  nameType: 'wrapped' | 'locked',
  additionalFuses?: number,
) {
  const approved = await publicClient.readContract({
    address: V1_BASE_REGISTRAR,
    abi: BASE_REGISTRAR_ABI,
    functionName: 'isApprovedForAll',
    args: [ownerAddress, V1_NAME_WRAPPER],
  })

  if (!approved) {
    const approveTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_BASE_REGISTRAR,
      data: encodeFunctionData({
        abi: BASE_REGISTRAR_ABI,
        functionName: 'setApprovalForAll',
        args: [V1_NAME_WRAPPER, true],
      }),
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  // For locked: always include CANNOT_UNWRAP, then OR in any additional fuses.
  // For wrapped: use additionalFuses directly (CANNOT_UNWRAP is NOT forced).
  const ownerFuses =
    nameType === 'locked'
      ? FUSES.CANNOT_UNWRAP | (additionalFuses ?? 0)
      : (additionalFuses ?? 0)

  console.log(
    `[makeV1Name] wrapping ${label}.eth (fuses=0x${ownerFuses.toString(16)}, type=${nameType})`,
  )

  const wrapTx = await walletClient.sendTransaction({
    account: ownerAccount,
    to: V1_NAME_WRAPPER,
    data: encodeFunctionData({
      abi: NAME_WRAPPER_ABI,
      functionName: 'wrapETH2LD',
      args: [label, ownerAddress, ownerFuses, V1_PUBLIC_RESOLVER],
    }),
  })
  await publicClient.waitForTransactionReceipt({ hash: wrapTx })

  const isWrapped = await publicClient.readContract({
    address: V1_NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: 'isWrapped',
    args: [namehash(`${label}.eth`)],
  })
  if (!isWrapped) {
    throw new Error(`[makeV1Name] wrapping failed for ${label}.eth`)
  }
}

// ---------------------------------------------------------------------------
// V1 record-setting helper
// ---------------------------------------------------------------------------
async function setV1Records(
  label: string,
  ownerAccount: ReturnType<typeof privateKeyToAccount>,
  nameType: V1NameType,
  records: NonNullable<V1NameConfig['records']>,
) {
  const node = namehash(`${label}.eth`)
  const hasRecords =
    (records.texts?.length ?? 0) + (records.addresses?.length ?? 0) > 0
  if (!hasRecords) return

  if (nameType === 'unwrapped') {
    const setResolverTx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_ENS_REGISTRY,
      data: encodeFunctionData({
        abi: ENS_REGISTRY_ABI,
        functionName: 'setResolver',
        args: [node, V1_PUBLIC_RESOLVER],
      }),
    })
    await waitForTx(setResolverTx)
  }

  for (const { key, value } of records.texts ?? []) {
    const tx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_PUBLIC_RESOLVER,
      data: encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [node, key, value],
      }),
    })
    await waitForTx(tx)
  }

  for (const { coinType, value } of records.addresses ?? []) {
    const tx = await walletClient.sendTransaction({
      account: ownerAccount,
      to: V1_PUBLIC_RESOLVER,
      data: encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setAddr',
        args: [node, BigInt(coinType), value],
      }),
    })
    await waitForTx(tx)
  }

  console.log(
    `[makeV1Name] set ${records.texts?.length ?? 0} text + ${records.addresses?.length ?? 0} addr records on ${label}.eth`,
  )
}
