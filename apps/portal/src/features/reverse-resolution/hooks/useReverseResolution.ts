import {
  getChainIdForReverseRegistrarChainId,
  getRegistrarAddress,
  l2ReverseRegistrarNameForAddrSnippet,
  type ReverseRegistrarChainId,
} from '@ens-apps/l2-primary/v1'
import { ResultFn } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getAddressRecord,
  getName,
  getReverseRecordFromRegistry,
} from '@ensdomains/ensjs/public'
import { ok } from 'neverthrow'
import {
  type Address,
  type Client,
  isAddress,
  isAddressEqual,
  type Transport,
} from 'viem'
import { readContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { DEFAULT_EVM_COIN_TYPE, MAINNET_COIN_TYPE } from '@/lib/coinType'
import type { sepoliaWithEns } from '@/lib/wagmi'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { l2WagmiConfig } from '@/lib/wagmiL2'
import type { ReverseResolutionNetwork } from '../config'

type EnsV1Client = Client<Transport, typeof sepoliaWithEns>

export type ReverseResolutionResult = {
  coinType: number
  reverseRegistrarChainId?: ReverseRegistrarChainId
  label: string
  icon: string
  name: string | null
  reverseResolverAddress: Address | null
  resolverAddress: Address | null
  normalized: boolean
  forwardMatch: boolean
  defaultName: string | null
}

type Network = ReverseResolutionNetwork

const REVERSE_RESOLUTION_NETWORK = 'sepolia' as const

function createEmptyResult(network: Network): ReverseResolutionResult {
  return {
    ...network,
    name: null,
    reverseResolverAddress: null,
    resolverAddress: null,
    normalized: true,
    forwardMatch: false,
    defaultName: null,
  }
}

/**
 * Read an L1 reverse record for a coin type via `getName`:
 * - `60` → `addr.reverse` (mainnet ETH), with a registry fallback for records
 *   whose forward resolution is broken/unset.
 * - `0x80000000` → `default.reverse` (ENSIP-19 cross-chain fallback).
 */
async function getL1ReverseRecord(
  client: EnsV1Client,
  address: Address,
  network: Network,
  coinType: number,
): Promise<ReverseResolutionResult> {
  let nameResult = await getName(client, {
    address,
    coinType,
    allowMismatch: true,
  })

  // The registry fallback only applies to `addr.reverse` (coin 60): it reads
  // the ENSv1 ReverseRegistrar's resolver directly when `getName` can't verify
  // a forward match. `default.reverse` has no such registry shortcut.
  if (!nameResult && coinType === MAINNET_COIN_TYPE) {
    const direct = await getReverseRecordFromRegistry(client, { address })

    if (direct) {
      nameResult = {
        name: direct.name,
        match: false,
        normalized: true,
        reverseResolverAddress: direct.reverseResolverAddress,
        resolverAddress: null,
      }
    }
  }

  return {
    ...network,
    name: nameResult?.name ?? null,
    reverseResolverAddress: nameResult?.reverseResolverAddress ?? null,
    resolverAddress: nameResult?.resolverAddress ?? null,
    normalized: nameResult?.normalized ?? true,
    forwardMatch: nameResult?.match ?? false,
    defaultName: null,
  }
}

async function getL2ReverseRecord(
  l1Client: EnsV1Client,
  address: Address,
  network: Network,
): Promise<ReverseResolutionResult> {
  const reverseRegistrarChainId =
    network.reverseRegistrarChainId as ReverseRegistrarChainId

  const registrarAddress = getRegistrarAddress(
    reverseRegistrarChainId,
    REVERSE_RESOLUTION_NETWORK,
  )

  if (!registrarAddress) {
    return createEmptyResult(network)
  }

  const chainId = getChainIdForReverseRegistrarChainId(
    reverseRegistrarChainId,
    REVERSE_RESOLUTION_NETWORK,
  )

  // L2 chains live in a separate, local-only wagmi config so we don't have
  // to pollute the explorer's global Sepolia-only config. See `@/lib/wagmiL2`.
  let l2Client: ReturnType<typeof l2WagmiConfig.getClient>
  try {
    l2Client = l2WagmiConfig.getClient({
      chainId: chainId as (typeof l2WagmiConfig)['chains'][number]['id'],
    })
  } catch {
    return createEmptyResult(network)
  }
  if (!l2Client) {
    return createEmptyResult(network)
  }

  const readContractAction = getAction(l2Client, readContract, 'readContract')
  const name = await readContractAction({
    address: registrarAddress,
    abi: l2ReverseRegistrarNameForAddrSnippet,
    functionName: 'nameForAddr',
    args: [address],
  })

  if (!name || name === '') {
    return createEmptyResult(network)
  }

  let forwardMatch = true
  try {
    // Per ENSIP-19, an L2 reverse record's forward verification reads the
    // chain-specific address record on the name's resolver. `network.coinType`
    // is the ENSIP-11 coin type for this environment — on Sepolia that's
    // derived from the TESTNET chain id (`0x80000000 | 84532` for Base
    // Sepolia, etc.), matching what the UniversalResolver verifies against.
    const addrRecord = await getAddressRecord(l1Client, {
      name,
      coin: network.coinType,
    })
    forwardMatch =
      !!addrRecord?.value &&
      isAddress(addrRecord.value, { strict: false }) &&
      isAddressEqual(addrRecord.value, address)
  } catch {
    forwardMatch = false
  }

  return {
    ...network,
    name,
    reverseResolverAddress: null,
    resolverAddress: null,
    normalized: true,
    forwardMatch,
    defaultName: null,
  }
}

async function getReverseRecordForNetwork(
  l1Client: EnsV1Client,
  address: Address,
  network: Network,
): Promise<ReverseResolutionResult> {
  // Route by coin type: Default (`default.reverse`) and Mainnet (`addr.reverse`)
  // are both L1 `getName` reads on different coin types; everything else is an
  // L2 `nameForAddr` read.
  if (network.coinType === DEFAULT_EVM_COIN_TYPE) {
    return getL1ReverseRecord(l1Client, address, network, DEFAULT_EVM_COIN_TYPE)
  }

  if (network.coinType === MAINNET_COIN_TYPE) {
    return getL1ReverseRecord(l1Client, address, network, MAINNET_COIN_TYPE)
  }

  return getL2ReverseRecord(l1Client, address, network)
}

const getReverseResolution = ResultFn(async function* ({
  address,
  networks,
}: {
  address: Address
  networks: Network[]
}) {
  const l1Client = yield* safeGetClient()

  const results = await Promise.allSettled(
    networks.map((network) =>
      getReverseRecordForNetwork(l1Client, address, network),
    ),
  )

  const resolvedResults: ReverseResolutionResult[] = results.map(
    (result, index) => {
      if (result.status === 'fulfilled') return result.value
      console.error(
        `[getReverseResolution] Error for ${networks[index].label}:`,
        result.reason,
      )
      return createEmptyResult(networks[index])
    },
  )

  // The name L2s inherit is the `default.reverse` record (coin type
  // `0x80000000`), NOT the coin-60 `addr.reverse` record. coin-60 ⊇
  // default.reverse, so a set coin-60 name does not mean the default is set —
  // deriving `defaultName` from coin 60 over-reports the L1 ETH primary name
  // onto every L2 that has no reverse record of its own.
  const defaultResult = await getName(l1Client, {
    address,
    coinType: DEFAULT_EVM_COIN_TYPE,
    allowMismatch: true,
  })
  const defaultName = defaultResult?.name ?? null

  return ok(resolvedResults.map((r) => ({ ...r, defaultName })))
})

const getReverseResolutionQueryKey = createQueryKey<
  'get-reverse-resolution',
  { address: Address }
>('get-reverse-resolution')

export const getReverseResolutionQueryOptions = (params: {
  address: Address
  networks: Network[]
}) =>
  resultQueryOptions({
    queryKey: getReverseResolutionQueryKey({
      address: params.address,
    }),
    queryFn: () => getReverseResolution(params),
  })
