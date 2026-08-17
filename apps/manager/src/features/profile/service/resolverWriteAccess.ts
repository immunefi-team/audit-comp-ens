import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { setRecordsWriteParameters } from '@ensdomains/ensjs/wallet'
import { fromPromise, ok } from 'neverthrow'
import {
  type Address,
  BaseError,
  ExecutionRevertedError,
  encodeFunctionData,
} from 'viem'
import { publicClient } from '@/lib/wagmi'
import { getProfileEthAddressSnapshot } from './profileEthAddress'

const ETH_COIN_TYPE = 60

class ResolverWriteAccessError extends TaggedError('ResolverWriteAccessError')<{
  cause: unknown
}> {}

/**
 * Dry-run the exact ETH-address write the "set primary name" flow performs
 * (built with the same ensjs `setRecordsWriteParameters` as the real write),
 * from the owner's wallet. Resolves `true` if it would succeed, `false` if it
 * reverts — the wallet lacks permission on the resolver — and throws on any
 * non-revert failure so the caller treats writability as unknown rather than
 * blocking. Exercising the real permission logic makes it correct for every
 * resolver type (per-name dedicated, per-owner, or registry-authorized).
 */
const canWriteEthAddressRecord = async (
  resolverAddress: Address,
  name: string,
  ownerAddress: Address,
): Promise<boolean> => {
  const { abi, functionName, args } = await setRecordsWriteParameters(
    publicClient as unknown as Parameters<typeof setRecordsWriteParameters>[0],
    {
      name,
      resolverAddress,
      coins: [{ coin: ETH_COIN_TYPE, value: ownerAddress }],
    },
  )
  try {
    // Probe from the EOA owner: the resolver authorizes the EOA even when the
    // real write is sent by its smart account (which the resolver unwraps).
    await publicClient.call({
      account: ownerAddress,
      to: resolverAddress,
      data: encodeFunctionData({
        abi,
        functionName,
        args,
      } as Parameters<typeof encodeFunctionData>[0]),
    })
    return true
  } catch (error) {
    if (
      error instanceof BaseError &&
      error.walk((e) => e instanceof ExecutionRevertedError)
    ) {
      return false
    }
    throw error
  }
}

export const getResolverWriteAccess = ResultFn(async function* (
  name?: string,
  ownerAddress?: Address,
) {
  if (!name || !ownerAddress) return ok(true)

  const { resolverAddress } = yield* getProfileEthAddressSnapshot(name)
  if (!resolverAddress) return ok(false)

  const writable = yield* fromPromise(
    canWriteEthAddressRecord(resolverAddress, name, ownerAddress),
    (e) => new ResolverWriteAccessError({ cause: e }),
  )

  return ok(writable)
})

export const resolverWriteAccessQuery = (
  name?: string,
  ownerAddress?: Address,
) =>
  resultQueryOptions({
    queryKey: qk('profile', 'resolver_write_access', { name, ownerAddress }),
    queryFn: () => getResolverWriteAccess(name, ownerAddress),
  })
