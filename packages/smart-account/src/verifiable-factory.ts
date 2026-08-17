import {
  type Address,
  concatHex,
  encodeAbiParameters,
  getContractAddress,
  keccak256,
} from 'viem'

const VERIFIABLE_PROXY_PREFIX =
  '0x3d604d80600a3d3981f3363d3d373d3d3d363d73' as const
const VERIFIABLE_PROXY_SUFFIX = '0x5af43d82803e903d91602b57fd5bf3' as const

export type ComputeVerifiableProxyAddressParams = {
  /** VerifiableFactory that executes CREATE2. */
  readonly factory: Address
  /** Factory-specific proxy logic embedded in the proxy creation bytecode. */
  readonly proxyLogic: Address
  /** Immediate caller of `VerifiableFactory.deployProxy`. */
  readonly deployer: Address
  /** Application salt passed to `VerifiableFactory.deployProxy`. */
  readonly salt: bigint
}

/**
 * Derive the deterministic proxy address produced by VerifiableFactory.
 *
 * VerifiableFactory namespaces the supplied salt by `msg.sender`, so callers
 * must provide the contract or account that will call `deployProxy`, not the
 * eventual proxy owner.
 */
export function computeVerifiableProxyAddress(
  params: ComputeVerifiableProxyAddressParams,
): Address {
  const outerSalt = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [params.deployer, params.salt],
    ),
  )
  const bytecode = concatHex([
    VERIFIABLE_PROXY_PREFIX,
    params.proxyLogic,
    VERIFIABLE_PROXY_SUFFIX,
    outerSalt,
  ])

  return getContractAddress({
    bytecode,
    from: params.factory,
    opcode: 'CREATE2',
    salt: outerSalt,
  })
}
