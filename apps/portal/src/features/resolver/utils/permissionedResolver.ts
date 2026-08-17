import {
  type Address,
  bytesToHex,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  parseAbi,
  stringToBytes,
} from 'viem'

// `PermissionedResolver.initialize` takes a third `setters` argument — a
// multicall batch of setter calls run at init time. We pass an empty array:
// the proxy is deployed with no initial records, exactly as before.
// See contracts-v2 `src/resolver/PermissionedResolver.sol`.
const permissionedResolverInitAbi = parseAbi([
  'function initialize(address owner, uint256 bitmap, bytes[] setters)',
])

const permissionedResolverRoleBitmap = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

const verifiableFactoryAbi = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data)',
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
])

export const generateResolverSalt = (name: string) => {
  // Use CSPRNG (not `Date.now()`/`Math.random()`) so the resolver salt is
  // unpredictable. The CREATE2 address is also bound to the deployer via
  // `keccak256(abi.encode(msg.sender, salt))`, but unpredictable randomness is
  // the correct hygiene for any on-chain-influencing value.
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return BigInt(keccak256(stringToBytes(`${name}:${bytesToHex(randomBytes)}`)))
}

export const getResolverInitCalldata = (ownerAddress: Address): Hex => {
  return encodeFunctionData({
    abi: permissionedResolverInitAbi,
    functionName: 'initialize',
    args: [ownerAddress, permissionedResolverRoleBitmap, []],
  })
}

export const parseProxyDeployedAddress = (
  logs: readonly { topics: readonly Hex[]; data: Hex }[],
): Address | null => {
  for (const log of logs) {
    if (log.topics.length === 0) continue

    try {
      const decoded = decodeEventLog({
        abi: verifiableFactoryAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      })

      if (decoded.eventName === 'ProxyDeployed') {
        return decoded.args.proxyAddress
      }
    } catch {
      // Ignore logs that don't match ProxyDeployed
    }
  }

  return null
}

export const decodeImplementationAddress = (
  storageValue: Hex | null | undefined,
): Address | null => {
  if (!storageValue || storageValue === '0x' || /^0x0+$/.test(storageValue)) {
    return null
  }

  const normalized = storageValue.slice(2).padStart(64, '0')
  const rawAddress = `0x${normalized.slice(24)}` as Address

  try {
    return getAddress(rawAddress)
  } catch {
    return null
  }
}

export interface ProxyDeployedLog {
  readonly args: {
    readonly implementation: Address
    readonly proxyAddress: Address
  }
}

export const filterPermissionedResolverAddresses = (
  logs: readonly ProxyDeployedLog[],
  expectedImplementation: Address,
): Address[] => {
  const addresses: Address[] = []
  const seen = new Set<string>()

  for (const log of [...logs].reverse()) {
    if (
      log.args.implementation.toLowerCase() !==
      expectedImplementation.toLowerCase()
    ) {
      continue
    }

    const normalized = log.args.proxyAddress.toLowerCase()
    if (seen.has(normalized)) continue

    seen.add(normalized)
    addresses.push(log.args.proxyAddress)
  }

  return addresses
}
