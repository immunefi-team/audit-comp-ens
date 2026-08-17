import {
  getChainIdForReverseRegistrarChainId,
  getRegistrarAddress,
  l2ReverseRegistrarNameForAddrSnippet,
  type ReverseRegistrarChainId,
} from '@ens-apps/l2-primary/v1'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { getAddressRecord, getName } from '@ensdomains/ensjs/public'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { readContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { l2WagmiConfig } from '@/lib/wagmiL2'

class PrimaryNameError extends TaggedError('PrimaryNameError')<{
  cause: unknown
}> {}

// ENSIP-19 fallback order: when the L1 default reverse (coin 60) doesn't
// forward-verify, walk the supported L2 chains and use the first one whose
// reverse record forward-verifies against its own chain-specific coin type.
//
// Sepolia only — the L2 reverse registrars we read are on the matching
// sepolia testnets via the local `l2WagmiConfig`.
const L2_FALLBACK_COIN_TYPES = [10, 42161, 8453, 59144, 534352] as const
const L2_REVERSE_NETWORK = 'sepolia' as const

const getPrimaryName = ResultFn(async function* (address: Address | undefined) {
  if (!address) return ok(null)

  const client = yield* safeGetClient()

  // Step 1: L1 default reverse (coin 60). ensjs `getName` calls
  // `UniversalResolver.reverse(addr, 60n)` and returns `{ name, match }`
  // where `match` is the ENSIP-3 forward-verified check.
  const defaultResult = yield* await fromPromise(
    getName(client, { address }),
    (e) => new PrimaryNameError({ cause: e }),
  )
  if (defaultResult?.match) return ok(defaultResult.name)

  // Step 2: ENSIP-19 fallback through L2 reverse registrars. We read each
  // L2 reverse registrar via the local `l2WagmiConfig` (the global explorer
  // config is L1-only by design — see `@/lib/wagmiL2`).
  for (const coinType of L2_FALLBACK_COIN_TYPES) {
    const registrarAddress = getRegistrarAddress(
      coinType as ReverseRegistrarChainId,
      L2_REVERSE_NETWORK,
    )
    if (!registrarAddress) continue

    const chainId = getChainIdForReverseRegistrarChainId(
      coinType as ReverseRegistrarChainId,
      L2_REVERSE_NETWORK,
    )

    let l2Client: ReturnType<typeof l2WagmiConfig.getClient>
    try {
      l2Client = l2WagmiConfig.getClient({
        chainId: chainId as (typeof l2WagmiConfig)['chains'][number]['id'],
      })
    } catch {
      continue
    }
    if (!l2Client) continue

    const readL2 = getAction(l2Client, readContract, 'readContract')
    let name: string
    try {
      name = await readL2({
        address: registrarAddress,
        abi: l2ReverseRegistrarNameForAddrSnippet,
        functionName: 'nameForAddr',
        args: [address],
      })
    } catch {
      continue
    }
    if (!name) continue

    // Per ENSIP-19, the forward verify reads the chain-specific address
    // record on the name's resolver, not the default ETH (coin 60) record.
    try {
      const addrRecord = await getAddressRecord(client, {
        name,
        coin: coinType,
      })
      if (
        addrRecord?.value &&
        addrRecord.value.toLowerCase() === address.toLowerCase()
      ) {
        return ok(name)
      }
    } catch {
      // resolver call failed — skip this chain
    }
  }

  return ok(null)
})

const getPrimaryNameQueryKey = createQueryKey<
  'get-primary-name',
  { address: Address | undefined }
>('get-primary-name')

export const getPrimaryNameQueryOptions = (address: Address | undefined) =>
  resultQueryOptions({
    queryKey: getPrimaryNameQueryKey({ address }),
    queryFn: () => getPrimaryName(address),
    enabled: !!address,
  })
