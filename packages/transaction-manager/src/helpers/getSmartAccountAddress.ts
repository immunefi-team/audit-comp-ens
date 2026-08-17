import { type Address, isAddressEqual } from 'viem'
import { SignerAddressMismatchError } from '../errors/transaction.errors'
import type { Signer } from '../types/signer.types'

/**
 * Get the smart account address from a signer.
 *
 * Only Rhinestone signers carry a smart-account address; other signer
 * types throw.
 *
 * When the signer carries a cached `config.accountAddress`, it is verified
 * against the live SDK address (`account.getAddress()`) before being trusted.
 * A divergence would let calldata be encoded against one address while the SDK
 * signs userOps from another — we fail fast with a tagged
 * {@link SignerAddressMismatchError} rather than return the stale value.
 */
export function getSmartAccountAddress(signer: Signer): Address {
  if (signer.type === 'rhinestone') {
    const liveAddress = signer.account.getAddress() as Address
    if (signer.config.accountAddress) {
      if (!isAddressEqual(signer.config.accountAddress, liveAddress)) {
        throw new SignerAddressMismatchError(
          signer.config.accountAddress,
          liveAddress,
        )
      }
      return signer.config.accountAddress
    }
    return liveAddress
  }

  throw new Error('Only Rhinestone signer is supported for this operation')
}
