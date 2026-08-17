import { getDestinationContracts } from '@ens-apps/smart-account'
import {
  type SUPPORTED_TOKEN,
  TOKENS,
} from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import {
  type GetRenewPriceErrorType as EnsGetRenewPriceErrorType,
  getRenewPrice as ensGetRenewPrice,
} from '@ensdomains/ensjs/public/v2'
import { err, fromPromise, ok } from 'neverthrow'
import { parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { publicClient, sepoliaWithEns } from '@/lib/wagmi'

const ETH_REGISTRAR = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensEthRegistrar',
})

// Standalone-HCA registrar from the shared remediated deployment manifest + its
// price getter. The displayed price
// MUST come from the SAME registrar the HCA flow actually pays, in the SAME
// token (Circle Sepolia USDC), so the quote the user sees matches what the
// commit/reveal charges. The legacy ensjs `ensEthRegistrar` + mock USDC path
// priced against a different contract and token.
const HCA_CONTRACTS = getDestinationContracts(sepolia.id)
const hcaRegistrarAbi = parseAbi([
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
])

// The contract computes the temporary premium from block.timestamp on every
// call, so cart total / banner pill / chart `nowPoint` need to refetch to
// stay aligned with the chain. Matches v3's cadence.
const PRICING_REFETCH_INTERVAL_MS = 60_000

export class GetRegisterPriceError extends TaggedError(
  'GetRegisterPriceError',
)<{
  readonly cause: unknown
}> {}

export class MissingTokenError extends TaggedError('MissingTokenError')<
  Record<string, never>
> {}

// Standalone-HCA `ETHRegistrar.getRegisterPrice` derives the temporary premium
// from on-chain state (time since `expiry + GRACE_PERIOD`) and returns
// `(base, premium)`. Priced in Circle USDC against the HCA registrar so the
// displayed quote matches what the commit/reveal actually charges.
export const getRegisterPrice = ResultFn(async function* (
  label: string,
  durationInSeconds: number,
  token: SUPPORTED_TOKEN | undefined,
) {
  if (!token) {
    return err(new MissingTokenError({}))
  }

  const [base, premium] = yield* fromPromise(
    publicClient.readContract({
      address: HCA_CONTRACTS.ethRegistrar,
      abi: hcaRegistrarAbi,
      functionName: 'getRegisterPrice',
      args: [label, BigInt(Math.ceil(durationInSeconds)), HCA_CONTRACTS.usdc],
    }),
    (e) => new GetRegisterPriceError({ cause: e }),
  )

  return ok({
    basePrice: base,
    premium,
  })
})

export const getRegisterPriceQueryOptions = (
  name: string,
  durationInSeconds: number,
  token: SUPPORTED_TOKEN | undefined,
) => {
  return resultQueryOptions({
    queryKey: $qk({
      $action: 'get-register-price',
      name,
      durationInSeconds,
      token,
    }),
    throwOnError: true,
    queryFn: () => getRegisterPrice(name, durationInSeconds, token),
    refetchInterval: PRICING_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

export class GetRenewPriceError extends TaggedError('GetRenewPriceError')<{
  readonly cause: EnsGetRenewPriceErrorType
}> {}

export const getRenewPrice = ResultFn(async function* (
  label: string,
  durationInSeconds: number,
  token: SUPPORTED_TOKEN | undefined,
) {
  if (!token) {
    return err(new MissingTokenError({}))
  }
  const tokenInfo = TOKENS[token]
  const price = yield* fromPromise(
    ensGetRenewPrice(publicClient, {
      renewerAddress: ETH_REGISTRAR,
      label,
      duration: BigInt(Math.ceil(durationInSeconds)),
      paymentToken: tokenInfo.address,
    }),
    (e) => new GetRenewPriceError({ cause: e as EnsGetRenewPriceErrorType }),
  )
  return ok(price)
})

export const getRenewPriceQueryOptions = (
  label: string,
  durationInSeconds: number,
  token: SUPPORTED_TOKEN | undefined,
) => {
  return resultQueryOptions({
    queryKey: $qk({
      $action: 'get-renew-price',
      label,
      durationInSeconds,
      token,
    }),
    queryFn: () => getRenewPrice(label, durationInSeconds, token),
  })
}
