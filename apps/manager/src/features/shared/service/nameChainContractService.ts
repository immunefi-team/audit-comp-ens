import { SUPPORTED_TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { getAvailable, getRegisterPrice } from '@ensdomains/ensjs/public/v2'
import { err, fromPromise, ok } from 'neverthrow'
import { type Address, formatUnits } from 'viem'
import { getChainId } from 'viem/actions'
import { publicClient } from '@/lib/wagmi'
import { validateENSName } from '../registration/nameUtils'
import { durationYearsToSeconds } from '../registration/pricing'

export interface TokenPriceInfo {
  raw: bigint
  formatted: string
  address: Address
  symbol: string
  decimals: number
  base: bigint
  premium: bigint
  total: bigint
}

export class NameChainContractError extends TaggedError(
  'NameChainContractError',
)<{
  cause: unknown
}> {}

export const checkRealNameAvailability = ResultFn(async function* (
  name: string,
) {
  const validation = validateENSName(name)

  if (validation) {
    return err(new NameChainContractError({ cause: validation.message }))
  }

  yield* fromPromise(getChainId(publicClient), (e) => {
    return new NameChainContractError({
      cause: `Network unreachable: ${e}`,
    })
  })

  // Check availability via the v2 registrar's `isAvailable`. The ensjs
  // action reads `client.chain.contracts.ensEthRegistrar` and is
  // eth-2ld-only, which matches what `validateENSName` already guarantees
  // here. Every caller passes a `.eth` name (normalizeQuery /
  // normalizeDomainNameFromUrl both append the suffix).
  const availability = yield* fromPromise(
    getAvailable(publicClient, { name }),
    (e) =>
      new NameChainContractError({
        cause: `Contract call failed: ${e}`,
      }),
  )

  return ok({
    isAvailable: availability,
    name,
  })
})

// Single source of truth for pricing - USDC and DAI.
// Takes the bare label: `getRegisterPrice` prices labels, and the caller
// (`getNamePricingQueryOptions`) strips the `.eth` suffix.
export const getTokenPrices = ResultFn(async function* (
  label: string,
  duration: number = 1, // in years
) {
  const durationInSeconds = durationYearsToSeconds(duration)

  const prices: Record<string, TokenPriceInfo> = {}

  for (const [tokenName, tokenAddress] of Object.entries(SUPPORTED_TOKENS)) {
    const { base, premium } = yield* fromPromise(
      getRegisterPrice(publicClient, {
        label,
        duration: BigInt(durationInSeconds),
        paymentToken: tokenAddress,
      }),
      (e) => new NameChainContractError({ cause: e }),
    )

    const totalPrice = base + premium
    const decimals = tokenName === 'USDC' ? 6 : 18 // USDC has 6 decimals, DAI has 18

    prices[tokenName.toLowerCase()] = {
      raw: totalPrice,
      formatted: formatUnits(totalPrice, decimals),
      address: tokenAddress,
      symbol: tokenName,
      decimals,
      base,
      premium,
      total: totalPrice,
    }
  }

  return ok(prices)
})
