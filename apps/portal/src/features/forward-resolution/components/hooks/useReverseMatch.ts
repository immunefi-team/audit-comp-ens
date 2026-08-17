import {
  getChainIdForReverseRegistrarChainId,
  getRegistrarAddress,
  l2ReverseRegistrarNameForAddrSnippet,
} from '@ens-apps/l2-primary/v1'
import { ResultFn } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { universalResolverReverseSnippet } from '@ensdomains/ensjs-abi/universalResolver'
import { ok } from 'neverthrow'
import {
  type Address,
  BaseError,
  type Client,
  ContractFunctionRevertedError,
  type Hex,
  hexToBytes,
  type Transport,
} from 'viem'
import { readContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { universalResolverAddress } from '@/lib/constants/universalResolver'
import type { sepoliaWithEns } from '@/lib/wagmi'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { l2WagmiConfig } from '@/lib/wagmiL2'
import type { L2ReverseRegistrarChainId } from '../AddressResolution/networks'

type EnsV1Client = Client<Transport, typeof sepoliaWithEns>

const REVERSE_MATCH_NETWORK = 'sepolia' as const

/** A forward-resolved address to reverse-check against the name. */
export type ReverseMatchNetwork = {
  coinType: number
  address: Address
  /**
   * L2 chain id for L2 rows. Enables the direct (unverified) read of that
   * chain's reverse registrar, which is what distinguishes a `pending`
   * verification from a genuine `mismatch`.
   */
  l2ChainId?: L2ReverseRegistrarChainId
}

/**
 * Verification state of the reverse half of an ENSIP-19 primary name.
 *
 * - `verified`: the L1 UniversalResolver resolved AND forward-verified the
 *   name for this coin type.
 * - `pending`: the chain's reverse registrar already holds this name (direct
 *   L2 read), but the L1-verified view doesn't reflect it yet — L2 state is
 *   only visible on L1 once its state root / rollup assertion is posted.
 * - `mismatch`: the verified view disagrees — no reverse record, a different
 *   name, or a name that fails forward verification.
 * - `unverifiable`: the L1 verification path itself errored (broken verifier,
 *   gateway failure, …) so no verdict is possible.
 */
export type ReverseMatchStatus =
  | 'verified'
  | 'pending'
  | 'mismatch'
  | 'unverifiable'

export type ReverseMatchResult = {
  coinType: number
  status: ReverseMatchStatus
  /**
   * The reverse name backing the status: the verified primary for `verified`
   * (or the conflicting/dangling name for `mismatch`), and the directly-read
   * L2 registrar name for `pending`/`unverifiable`.
   */
  reverseName: string | null
  /**
   * For `unverifiable`: the decoded reason the verification path failed, e.g.
   * `ResolverError(0xeb57ceb9)` or `HttpError(504, Gateway timeout)`.
   */
  error: string | null
}

function namesEqual(reverseName: string | null | undefined, name: string) {
  return !!reverseName && reverseName.toLowerCase() === name.toLowerCase()
}

/** Decode a DNS-encoded (length-prefixed labels) name to a dotted string. */
function dnsDecodeName(data: Hex): string | null {
  try {
    const bytes = hexToBytes(data)
    const labels: string[] = []
    let offset = 0
    while (offset < bytes.length) {
      const length = bytes[offset]
      if (length === 0) break
      labels.push(
        new TextDecoder().decode(bytes.slice(offset + 1, offset + 1 + length)),
      )
      offset += length + 1
    }
    return labels.length > 0 ? labels.join('.') : null
  } catch {
    return null
  }
}

type UrReverseOutcome =
  /** Reverse record resolved and forward-verified to this address. */
  | { type: 'name'; name: string }
  /** No reverse record for this coin type (per the verified view). */
  | { type: 'none' }
  /** Reverse record exists but its name fails forward verification. */
  | { type: 'broken'; name: string | null }
  /** The verification machinery itself failed — no verdict. */
  | { type: 'unverifiable'; detail: string | null }

/** Compact human-readable form of a decoded UniversalResolver revert. */
function formatRevertDetail(revert: ContractFunctionRevertedError): string {
  if (revert.data?.errorName) {
    const args = ((revert.data.args ?? []) as readonly unknown[])
      .map((arg) => String(arg))
      .join(', ')
    return `${revert.data.errorName}(${args})`
  }
  return revert.signature ?? revert.shortMessage
}

/**
 * Reverse-resolve an address for a coin type through the L1 UniversalResolver
 * and classify the outcome instead of collapsing every failure to `null`
 * (which is what `getEnsName`/`getName` do via `isNullUniversalResolverError`).
 *
 * `UR.reverse` forward-verifies on-chain, so a successful non-empty name IS a
 * verified primary. Reverts are split into semantic verdicts vs infrastructure
 * failures:
 * - `ReverseAddressMismatch(primary, addr)`: name resolved but its
 *   `addr(coinType)` points elsewhere → broken pair.
 * - `ResolverNotFound(name)`: the name in the error is the one that had no
 *   resolver. A `*.reverse` name means the reverse namespace itself is
 *   unresolvable (infra); anything else is the resolved primary candidate
 *   dangling (e.g. pointing at an unregistered name) → broken pair.
 * - `ResolverError`/`HttpError`/… and non-revert failures (gateway/network):
 *   unverifiable — the check errored, the pair may well be fine.
 */
async function getUrReverseOutcome(
  client: EnsV1Client,
  address: Address,
  coinType: number,
): Promise<UrReverseOutcome> {
  const readContractAction = getAction(client, readContract, 'readContract')
  try {
    const [name] = await readContractAction({
      address: universalResolverAddress,
      abi: universalResolverReverseSnippet,
      functionName: 'reverse',
      args: [address, BigInt(coinType)],
    })
    if (!name) return { type: 'none' }
    return { type: 'name', name }
  } catch (error) {
    if (!(error instanceof BaseError))
      return { type: 'unverifiable', detail: null }
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (!(revert instanceof ContractFunctionRevertedError))
      return { type: 'unverifiable', detail: error.shortMessage }

    switch (revert.data?.errorName) {
      case 'ReverseAddressMismatch': {
        const [primary] = revert.data.args as readonly [string, Hex]
        return { type: 'broken', name: primary || null }
      }
      case 'ResolverNotFound': {
        const [dnsName] = revert.data.args as readonly [Hex]
        const decoded = dnsDecodeName(dnsName)
        if (decoded?.endsWith('.reverse'))
          return {
            type: 'unverifiable',
            detail: `ResolverNotFound(${decoded})`,
          }
        return { type: 'broken', name: decoded }
      }
      default:
        return { type: 'unverifiable', detail: formatRevertDetail(revert) }
    }
  }
}

/**
 * Read the chain's reverse registrar directly on the L2 — the unverified
 * ground truth of what was written, available instantly while the L1-verified
 * view lags behind the chain's state-root cadence.
 */
async function getDirectL2ReverseName(
  l2ChainId: L2ReverseRegistrarChainId,
  address: Address,
): Promise<string | null> {
  const registrarAddress = getRegistrarAddress(l2ChainId, REVERSE_MATCH_NETWORK)
  if (!registrarAddress) return null

  const chainId = getChainIdForReverseRegistrarChainId(
    l2ChainId,
    REVERSE_MATCH_NETWORK,
  )

  let l2Client: ReturnType<typeof l2WagmiConfig.getClient>
  try {
    l2Client = l2WagmiConfig.getClient({
      chainId: chainId as (typeof l2WagmiConfig)['chains'][number]['id'],
    })
  } catch {
    return null
  }
  if (!l2Client) return null

  const readContractAction = getAction(l2Client, readContract, 'readContract')
  const name = await readContractAction({
    address: registrarAddress,
    abi: l2ReverseRegistrarNameForAddrSnippet,
    functionName: 'nameForAddr',
    args: [address],
  }).catch(() => null)

  return name || null
}

async function getReverseMatchForNetwork(
  client: EnsV1Client,
  name: string,
  network: ReverseMatchNetwork,
): Promise<ReverseMatchResult> {
  const [outcome, directName] = await Promise.all([
    getUrReverseOutcome(client, network.address, network.coinType),
    network.l2ChainId != null
      ? getDirectL2ReverseName(network.l2ChainId, network.address)
      : Promise.resolve(null),
  ])

  if (outcome.type === 'name' && namesEqual(outcome.name, name)) {
    return {
      coinType: network.coinType,
      status: 'verified',
      reverseName: outcome.name,
      error: null,
    }
  }

  if (outcome.type === 'unverifiable') {
    // No verdict from L1. Surface the direct read (if any) so the UI can at
    // least say what's set on the L2 itself.
    return {
      coinType: network.coinType,
      status: 'unverifiable',
      reverseName: directName,
      error: outcome.detail,
    }
  }

  // The verified view disagrees (other/no/broken name). If the L2 registrar
  // already holds this exact name, the write simply hasn't propagated to L1
  // yet — the verified view is reading pre-write state.
  if (namesEqual(directName, name)) {
    return {
      coinType: network.coinType,
      status: 'pending',
      reverseName: directName,
      error: null,
    }
  }

  return {
    coinType: network.coinType,
    status: 'mismatch',
    reverseName: outcome.type === 'none' ? null : outcome.name,
    error: null,
  }
}

const getReverseMatches = ResultFn(async function* ({
  name,
  networks,
}: {
  name: string
  networks: ReverseMatchNetwork[]
}) {
  const l1Client = yield* safeGetClient()

  const results = await Promise.allSettled(
    networks.map((network) =>
      getReverseMatchForNetwork(l1Client, name, network),
    ),
  )

  const resolved: ReverseMatchResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value
    console.error(
      `[getReverseMatches] Error for coin ${networks[index].coinType}:`,
      result.reason,
    )
    return {
      coinType: networks[index].coinType,
      status: 'unverifiable',
      reverseName: null,
      error: result.reason instanceof Error ? result.reason.message : null,
    }
  })

  return ok(resolved)
})

const getReverseMatchesQueryKey = createQueryKey<
  'get-reverse-matches',
  { name: string; addresses: string }
>('get-reverse-matches')

export const getReverseMatchesQueryOptions = ({
  name,
  networks,
}: {
  name: string
  networks: ReverseMatchNetwork[]
}) =>
  resultQueryOptions({
    queryKey: getReverseMatchesQueryKey({
      name,
      addresses: networks.map((n) => `${n.coinType}:${n.address}`).join(','),
    }),
    queryFn: () => getReverseMatches({ name, networks }),
    enabled: networks.length > 0,
  })
