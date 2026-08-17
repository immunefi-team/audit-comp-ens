import { type Address, getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { SignerAddressMismatchError } from '../errors/transaction.errors'
import type { RhinestoneSigner, Signer } from '../types/signer.types'
import { getSmartAccountAddress } from './getSmartAccountAddress'

const HCA_A = getAddress('0x1111111111111111111111111111111111111111')
const HCA_B = getAddress('0x2222222222222222222222222222222222222222')

/** Build a minimal Rhinestone signer whose SDK reports `liveAddress`. */
function rhinestoneSigner(opts: {
  liveAddress: Address
  configAddress?: Address
}): RhinestoneSigner {
  return {
    type: 'rhinestone',
    account: {
      getAddress: () => opts.liveAddress,
    } as unknown as RhinestoneSigner['account'],
    config: {
      // biome-ignore lint/suspicious/noExplicitAny: minimal chain stub for the test
      chain: {} as any,
      rhinestoneApiKey: 'test-key',
      ...(opts.configAddress ? { accountAddress: opts.configAddress } : {}),
    },
  }
}

describe('getSmartAccountAddress', () => {
  it('returns the cached config.accountAddress when it matches the live SDK address', () => {
    const signer = rhinestoneSigner({
      liveAddress: HCA_A,
      configAddress: HCA_A,
    })
    expect(getSmartAccountAddress(signer)).toBe(HCA_A)
  })

  it('falls back to the live SDK address when no cached address is set', () => {
    const signer = rhinestoneSigner({ liveAddress: HCA_A })
    expect(getSmartAccountAddress(signer)).toBe(HCA_A)
  })

  it('throws SignerAddressMismatchError when cached address diverges from live', () => {
    const signer = rhinestoneSigner({
      liveAddress: HCA_B,
      configAddress: HCA_A,
    })
    expect(() => getSmartAccountAddress(signer)).toThrow(
      SignerAddressMismatchError,
    )
  })

  it('mismatch error carries expected (cached) and actual (live) addresses', () => {
    const signer = rhinestoneSigner({
      liveAddress: HCA_B,
      configAddress: HCA_A,
    })
    try {
      getSmartAccountAddress(signer)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SignerAddressMismatchError)
      const e = error as SignerAddressMismatchError
      expect(e.expected).toBe(HCA_A)
      expect(e.actual).toBe(HCA_B)
    }
  })

  it('throws for non-rhinestone signers', () => {
    const eoaSigner = { type: 'eoa' } as unknown as Signer
    expect(() => getSmartAccountAddress(eoaSigner)).toThrow(
      'Only Rhinestone signer is supported',
    )
  })
})
