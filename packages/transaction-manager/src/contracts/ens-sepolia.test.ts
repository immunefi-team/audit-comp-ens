import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { ENS_SEPOLIA_CONTRACTS, SUPPORTED_TOKENS, TOKENS } from './ens-sepolia'

/**
 * Every address these maps hand out eventually reaches viem, which rejects a
 * mixed-case address whose EIP-55 checksum does not match — `Address "0x…" is
 * invalid`. A single wrong-case character is invisible on review and does not
 * fail a typecheck, a lint, or a `cast call` (cast does not verify checksums),
 * so it survives all the way to a user's wallet and fails at submission.
 *
 * That is exactly how a mis-checksummed `ReverseRegistrarAdapter` shipped.
 */
const expectChecksummed = (label: string, address: string) => {
  // `getAddress` throws on a checksum mismatch and returns the canonical form
  // otherwise, so equality here also catches a merely-lowercased entry that
  // happens to be accepted elsewhere.
  expect(
    () => getAddress(address),
    `${label} is not a valid address`,
  ).not.toThrow()
  expect(getAddress(address), `${label} is not EIP-55 checksummed`).toBe(
    address,
  )
}

describe('ENS_SEPOLIA_CONTRACTS', () => {
  it.each(
    Object.entries(ENS_SEPOLIA_CONTRACTS),
  )('%s is a checksummed address', (label, address) => {
    expectChecksummed(label, address)
  })
})

describe('token maps', () => {
  it.each(
    Object.entries(SUPPORTED_TOKENS),
  )('SUPPORTED_TOKENS.%s is a checksummed address', (label, address) => {
    expectChecksummed(label, address)
  })

  it.each(
    Object.entries(TOKENS),
  )('TOKENS.%s.address is a checksummed address', (label, token) => {
    expectChecksummed(label, token.address)
  })
})
