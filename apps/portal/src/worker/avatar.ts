/**
 * Avatar-record resolution for the OG-image worker (WEB-672).
 *
 * This replaces viem's `parseAvatarRecord`, which we can't use server-side
 * because it performs two unguarded network calls of its own:
 *
 * - `isImageUri()` HEADs the resolved URL purely to sniff its Content-Type,
 *   doubling the hit on an attacker-chosen endpoint. We drop it entirely — the
 *   real GET already validates Content-Type, so the HEAD bought nothing.
 * - `getMetadataAvatarUri()` does `fetch(uri).then(r => r.json())` on an
 *   `eip155:` token URI with no timeout, no size cap and no Content-Type check.
 *
 * Neither is reachable through viem's public API. `viem/ens` exports only
 * `parseAvatarRecord` itself; `parseNftUri`, `getNftTokenUri`, `getJsonImage`
 * and `resolveAvatarUri` are internal, and viem's `exports` map refuses a deep
 * import of the module holding them (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so
 * there's no way to reuse them. Patching `globalThis.fetch` around the call
 * would race across concurrent requests in a shared isolate.
 *
 * So the URI-resolution logic below is ported from
 * `viem/utils/ens/avatar/utils.ts` (v2.52.2) with the fetches routed through
 * {@link safeFetch}. Keep it in sync when bumping viem. The ERC721/ERC1155
 * ABIs are *not* ported — those come from viem's public `erc721Abi` /
 * `erc1155Abi`, so URI parsing is the only part that can drift.
 */

import { erc721Abi, erc1155Abi } from 'viem'
import { readContract } from 'viem/actions'

import type { EnsClient } from './clients'
import { safeFetch } from './safe-fetch'

/** Gateway used for `ipfs://` / `ipns://` records — mirrors `csp.ts` CONNECT_HOSTS. */
const IPFS_GATEWAY = 'https://ipfs.euc.li'
const ARWEAVE_GATEWAY = 'https://arweave.net'

/** Stateless and reusable — no need to allocate one per metadata fetch. */
const utf8Decoder = new TextDecoder()

/**
 * NFT metadata documents are small JSON blobs; cap them far below the image
 * budget so a hostile tokenURI can't stream megabytes into `JSON.parse`.
 */
const METADATA_MAX_BYTES = 256 * 1024

/**
 * IPFS gateways commonly serve raw `.json` files as `text/plain`, and some
 * serve them as `application/octet-stream`, so a strict `application/json`
 * check would break legitimate NFT avatars. This body is only parsed
 * internally and never echoed back to the caller, so the looser matcher costs
 * us nothing — the size cap is what matters here.
 */
const METADATA_CONTENT_TYPES = new Set([
  'application/json',
  'text/plain',
  'application/octet-stream',
])

// Ported verbatim from viem so URI parsing stays behaviour-compatible.
const networkRegex =
  /(?<protocol>https?:\/\/[^/]*|ipfs:\/|ipns:\/|ar:\/)?(?<root>\/)?(?<subpath>ipfs\/|ipns\/)?(?<target>[\w\-.]+)(?<subtarget>\/.*)?/
const ipfsHashRegex =
  /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})(\/(?<target>[\w\-.]+))?(?<subtarget>\/.*)?$/
const base64Regex = /^data:([a-zA-Z\-/+]*);base64,([^"].*)/
const dataURIRegex = /^data:([a-zA-Z\-/+]*)?(;[a-zA-Z0-9].*?)?(,)/

/**
 * An avatar record resolves either to content that is already inline (on-chain
 * `data:` URIs, raw SVG) or to a URL that still has to be dereferenced.
 */
export type ResolvedAvatarUri =
  | { readonly kind: 'inline'; readonly uri: string }
  | { readonly kind: 'remote'; readonly url: string }

interface ResolvedUri {
  readonly uri: string
  readonly isOnChain: boolean
  readonly isEncoded: boolean
}

/**
 * Rewrite `ipfs://`, `ipns://`, `ar://` and bare CIDs onto their gateways.
 *
 * biome-ignore lint/complexity/noExcessiveCognitiveComplexity: kept as a
 * near-verbatim port of viem's `resolveAvatarUri` so it can be diffed against
 * upstream on a version bump. Restructuring it would make that check — the
 * thing that stops this drifting into a subtly different URI parser — much
 * harder, which is a worse trade than the branch count.
 */
function resolveAvatarUri(uri: string): ResolvedUri {
  if (base64Regex.test(uri)) return { uri, isOnChain: true, isEncoded: true }

  const match = uri.match(networkRegex)
  const { protocol, subpath, target, subtarget = '' } = match?.groups ?? {}

  const isIpns = protocol === 'ipns:/' || subpath === 'ipns/'
  const isIpfs =
    protocol === 'ipfs:/' || subpath === 'ipfs/' || ipfsHashRegex.test(uri)

  if (uri.startsWith('http') && !isIpns && !isIpfs) {
    return { uri, isOnChain: false, isEncoded: false }
  }

  if ((isIpns || isIpfs) && target) {
    return {
      uri: `${IPFS_GATEWAY}/${isIpns ? 'ipns' : 'ipfs'}/${target}${subtarget}`,
      isOnChain: false,
      isEncoded: false,
    }
  }

  if (protocol === 'ar:/' && target) {
    return {
      uri: `${ARWEAVE_GATEWAY}/${target}${subtarget}`,
      isOnChain: false,
      isEncoded: false,
    }
  }

  let parsed = uri.replace(dataURIRegex, '')
  if (parsed.startsWith('<svg')) {
    parsed = `data:image/svg+xml;base64,${btoa(parsed)}`
  }
  if (parsed.startsWith('data:') || parsed.startsWith('{')) {
    return { uri: parsed, isOnChain: true, isEncoded: false }
  }

  throw new Error(`unresolvable avatar uri: ${uri}`)
}

interface ParsedNft {
  readonly namespace: string
  readonly contractAddress: `0x${string}`
  readonly tokenID: string
}

/** Parse a CAIP-22/CAIP-29 NFT URI (`eip155:1/erc721:0x…/123`). */
function parseNftUri(raw: string): ParsedNft {
  // Convert DID form to CAIP.
  const uri = raw.startsWith('did:nft:')
    ? raw.replace('did:nft:', '').replace(/_/g, '/')
    : raw

  const [reference, assetNamespace, tokenID] = uri.split('/')
  const [eipNamespace, chainID] = reference?.split(':') ?? []
  const [ercNamespace, contractAddress] = assetNamespace?.split(':') ?? []

  if (eipNamespace?.toLowerCase() !== 'eip155') {
    throw new Error('only eip155 NFT avatars are supported')
  }
  if (!chainID) throw new Error('NFT avatar chain ID not found')
  if (!contractAddress) throw new Error('NFT avatar contract address not found')
  if (!tokenID) throw new Error('NFT avatar token ID not found')
  if (!ercNamespace) throw new Error('NFT avatar ERC namespace not found')

  return {
    namespace: ercNamespace.toLowerCase(),
    contractAddress: contractAddress as `0x${string}`,
    tokenID,
  }
}

/**
 * Read `tokenURI`/`uri` off the NFT contract.
 *
 * Like viem, this reads on the client's connected chain and ignores the CAIP
 * chain ID — the OG worker is single-chain, so a cross-chain avatar record
 * simply fails to resolve rather than silently reading the wrong contract.
 */
function getNftTokenUri(client: EnsClient, nft: ParsedNft): Promise<string> {
  if (nft.namespace === 'erc721') {
    return readContract(client, {
      address: nft.contractAddress,
      abi: erc721Abi,
      functionName: 'tokenURI',
      args: [BigInt(nft.tokenID)],
    })
  }
  if (nft.namespace === 'erc1155') {
    return readContract(client, {
      address: nft.contractAddress,
      abi: erc1155Abi,
      functionName: 'uri',
      args: [BigInt(nft.tokenID)],
    })
  }
  throw new Error(`unsupported NFT namespace: ${nft.namespace}`)
}

/**
 * Pull the image field out of an NFT metadata document.
 *
 * `image_data` is typically a raw SVG rather than a URL; {@link resolveAvatarUri}
 * inlines that case.
 */
function getJsonImage(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('NFT metadata is not an object')
  }

  const { image, image_url, image_data } = data as Record<string, unknown>
  const source = image ?? image_url ?? image_data

  // Covers absent, non-string and empty — all unusable, all handled the same.
  if (typeof source !== 'string' || !source) {
    throw new Error('NFT metadata has no usable image field')
  }
  return source
}

/** Turn a `ResolvedUri` into the public {@link ResolvedAvatarUri} shape. */
function toResolvedAvatar(resolved: ResolvedUri): ResolvedAvatarUri {
  return resolved.isOnChain
    ? { kind: 'inline', uri: resolved.uri }
    : { kind: 'remote', url: resolved.uri }
}

/** Take a parsed NFT metadata document to the avatar it points at. */
function avatarFromMetadata(metadata: unknown): ResolvedAvatarUri {
  return toResolvedAvatar(resolveAvatarUri(getJsonImage(metadata)))
}

/** Fetch and parse an NFT metadata document through the guarded fetch. */
async function fetchMetadataImage(
  url: string,
  selfHost?: string,
): Promise<ResolvedAvatarUri> {
  const result = await safeFetch(url, {
    accept: (contentType) => METADATA_CONTENT_TYPES.has(contentType),
    maxBytes: METADATA_MAX_BYTES,
    selfHost,
  })
  if (!result) throw new Error(`NFT metadata fetch rejected: ${url}`)

  return avatarFromMetadata(JSON.parse(utf8Decoder.decode(result.bytes)))
}

/**
 * Resolve an ENS `avatar` text record to either inline content or a URL to
 * fetch. Drop-in replacement for viem's `parseAvatarRecord`, minus the
 * unguarded network calls.
 */
export async function resolveAvatarRecord(
  client: EnsClient,
  record: string,
  selfHost?: string,
): Promise<ResolvedAvatarUri> {
  if (!/eip155:/i.test(record)) {
    return toResolvedAvatar(resolveAvatarUri(record))
  }

  const nft = parseNftUri(record)
  const tokenUri = await getNftTokenUri(client, nft)
  const resolved = resolveAvatarUri(tokenUri)

  // Metadata embedded on-chain: decode it directly, no fetch required.
  if (
    resolved.isOnChain &&
    (resolved.uri.includes('data:application/json;base64,') ||
      resolved.uri.startsWith('{'))
  ) {
    const raw = resolved.isEncoded
      ? atob(resolved.uri.replace('data:application/json;base64,', ''))
      : resolved.uri
    return avatarFromMetadata(JSON.parse(raw))
  }

  const tokenId =
    nft.namespace === 'erc1155'
      ? nft.tokenID.replace('0x', '').padStart(64, '0')
      : nft.tokenID

  return fetchMetadataImage(
    resolved.uri.replace(/(?:0x)?{id}/, tokenId),
    selfHost,
  )
}
