import {
  type Address,
  encodeFunctionData,
  type Hash,
  namehash,
  parseAbi,
} from 'viem'
import type { privateKeyToAccount } from 'viem/accounts'

import { publicClient, walletClient } from '../helpers/anvil-client.js'
import { V1_NAME_WRAPPER } from './makeV1Name.js'

// ---------------------------------------------------------------------------
// Parent-controlled fuse constants (bits 16-17)
// ---------------------------------------------------------------------------
// PARENT_CANNOT_CONTROL emancipates the child; the parent can no longer burn fuses or reclaim it.
export const PARENT_CANNOT_CONTROL = 1 << 16
export const IS_DOT_ETH = 1 << 17

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const NAME_WRAPPER_ABI = parseAbi([
  'function setSubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry) returns (bytes32)',
  'function getData(uint256 tokenId) view returns (address owner, uint32 fuses, uint64 expiry)',
])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type V1SubnameConfig = {
  parentLabel: string
  childLabel: string
  ownerAddress: Address
  ownerAccount: ReturnType<typeof privateKeyToAccount>
  parentOwnerAccount: ReturnType<typeof privateKeyToAccount>
  /**
   * Owner-controlled fuse bits OR'd into the child token (beyond PARENT_CANNOT_CONTROL).
   * Pass FUSES.CANNOT_UNWRAP to create an emancipated (locked) child.
   */
  childFuses?: number
  expiryOffset?: number
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function waitForTx(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash })
}

// ---------------------------------------------------------------------------
// makeV1Subname
// ---------------------------------------------------------------------------
export async function makeV1Subname(config: V1SubnameConfig): Promise<string> {
  const {
    parentLabel,
    childLabel,
    ownerAddress,
    parentOwnerAccount,
    childFuses = 0,
    expiryOffset = 365 * 24 * 60 * 60,
  } = config

  const parentNode = namehash(`${parentLabel}.eth`)
  const expiry = BigInt(Math.floor(Date.now() / 1000) + expiryOffset)

  // PARENT_CANNOT_CONTROL is always set so the parent cannot reclaim the child.
  const fuses = PARENT_CANNOT_CONTROL | childFuses

  console.log(
    `[makeV1Subname] creating ${childLabel}.${parentLabel}.eth (fuses=0x${fuses.toString(16)})`,
  )

  const hash = await walletClient.sendTransaction({
    account: parentOwnerAccount,
    to: V1_NAME_WRAPPER,
    data: encodeFunctionData({
      abi: NAME_WRAPPER_ABI,
      functionName: 'setSubnodeOwner',
      args: [parentNode, childLabel, ownerAddress, fuses, expiry],
    }),
  })
  await waitForTx(hash)

  const childName = `${childLabel}.${parentLabel}.eth`
  console.log(`[makeV1Subname] ✅ ${childName} (owner: ${ownerAddress})`)
  return childName
}
