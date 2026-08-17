import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { fromPromise, ok, okAsync } from 'neverthrow'
import type { Address } from 'viem'
import { getEnsName } from 'viem/actions'
import { safeGetClient } from '@/lib/wagmi/helpers'

class ReverseResolverError extends TaggedError('ReverseResolverError')<{
  cause: unknown
}> {}

/**
 * Resolves the primary (reverse) name for an address.
 *
 * ENSIP-19 reverse resolution via the UniversalResolver's
 * `reverseWithGateways(address, coinType)`: the forward-verification
 * (bidirectional check) and the chain-specific → `default.reverse` fallback
 * both happen on-chain in the reverse resolvers, so the client makes exactly
 * one call and must not implement its own fallback/default handling
 * (ENSIP-19 § Deprecating Mainnet as Default).
 *
 * The manager is an L1-only app, so we resolve the L1 primary: viem's
 * `getEnsName` defaults `coinType` to `60n` (`addr.reverse`), which is the
 * correct coin type for L1 testnets like Sepolia per ENSIP-19.
 *
 * Returns `null` when the address has no verified primary name (including
 * when the reverse claim does not forward-resolve back to the address).
 */
export const getReverseName = ResultFn(async function* (address?: Address) {
  if (!address) return ok(null)

  const client = yield* safeGetClient()

  const name = yield* fromPromise(
    getEnsName(client, { address }),
    (e) => new ReverseResolverError({ cause: e }),
  ).orElse(() => okAsync<string | null, never>(null))

  return ok(name)
})

export const profileReverseNameQuery = (address?: Address) =>
  resultQueryOptions({
    queryKey: qk('profile', 'reverse_name', { address }),
    queryFn: ({ queryKey: [{ address }] }) => getReverseName(address),
  })
