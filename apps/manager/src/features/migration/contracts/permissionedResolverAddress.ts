import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  stringToHex,
} from 'viem'
import { PERMISSIONED_RESOLVER_ABI } from './abis'

const ALL_ROLES: bigint = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

const OWNED_RESOLVER_ID: Hex = keccak256(stringToHex('OwnedResolver'))

export const computeOwnedResolverSalt = (
  owner: Address,
  version: bigint = 0n,
): bigint =>
  BigInt(
    keccak256(
      encodeAbiParameters(
        [
          { name: 'id', type: 'bytes32' },
          { name: 'owner', type: 'address' },
          { name: 'version', type: 'uint256' },
        ],
        [OWNED_RESOLVER_ID, owner, version],
      ),
    ),
  )

export const getOwnedPermResInitCalldata = (admin: Address): Hex =>
  encodeFunctionData({
    abi: PERMISSIONED_RESOLVER_ABI,
    functionName: 'initialize',
    args: [admin, ALL_ROLES, []],
  })
