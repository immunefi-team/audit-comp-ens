import { ethRegistrarRentPriceOracleSnippet } from '@ensdomains/ensjs-abi/v2/ethRegistrar'
import { standardRentPriceOracleIsPaymentTokenSnippet } from '@ensdomains/ensjs-abi/v2/standardRentPriceOracle'
import type { Address, PublicClient } from 'viem'
import { readContract } from 'viem/actions'

/**
 * Checks whether `paymentToken` is whitelisted on the registrar's rent price
 * oracle.
 *
 * The production v2 `ETHRegistrar` does **not** expose `isPaymentToken`
 * directly — that function lives on the registrar's `rentPriceOracle()`.
 * Resolving the oracle off the registrar at runtime keeps the check truthful
 * without hardcoding the oracle address (which has changed across V2
 * redeploys).
 *
 * Returns `false` for unknown / unwhitelisted tokens, throws only if the
 * registrar itself fails to respond (RPC error, wrong address, etc.).
 */
export async function isPaymentTokenSupported(
  publicClient: PublicClient,
  registrarAddress: Address,
  paymentToken: Address,
): Promise<boolean> {
  const oracle = await readContract(publicClient, {
    address: registrarAddress,
    abi: ethRegistrarRentPriceOracleSnippet,
    functionName: 'rentPriceOracle',
  })
  return readContract(publicClient, {
    address: oracle,
    abi: standardRentPriceOracleIsPaymentTokenSnippet,
    functionName: 'isPaymentToken',
    args: [paymentToken],
  })
}

/**
 * Throws if `paymentToken` is not whitelisted on the registrar's rent price
 * oracle. Wraps {@link isPaymentTokenSupported}.
 */
export async function assertPaymentTokenSupported(
  publicClient: PublicClient,
  registrarAddress: Address,
  paymentToken: Address,
): Promise<void> {
  const supported = await isPaymentTokenSupported(
    publicClient,
    registrarAddress,
    paymentToken,
  )
  if (!supported) {
    throw new Error(
      `Payment token ${paymentToken} is not supported by the ENS registrar at ${registrarAddress}`,
    )
  }
}
