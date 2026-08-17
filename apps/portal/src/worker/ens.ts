import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { getRecords } from '@ensdomains/ensjs/public'
import type { Address, Hex } from 'viem'
import { getStorageAt } from 'viem/actions'

import { decodeImplementationAddress } from '@/features/resolver/utils/permissionedResolver'
import { resolveEnsOwner } from '@/utils/ens/resolveEnsOwner'
import { resolveAvatarRecord } from './avatar'
import { createClient, type EnsClient } from './clients'
import { safeFetch } from './safe-fetch'

export interface EnsData {
  avatar: string | null
  description: string | null
  owner: string | null
}

/** Cap the avatar payload to avoid memory-exhaustion / amplification abuse. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/**
 * Base64-encode bytes via the runtime's native `btoa`.
 *
 * `btoa` takes a binary string, so we build one in chunks with
 * `String.fromCharCode.apply` rather than concatenating per byte (which would
 * allocate O(n) intermediate strings for multi-MB avatars).
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000 // 32K args — stays under the call-stack arg limit
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    )
  }
  return btoa(binary)
}

/**
 * Resolve an ENS `avatar` text record to an inline `data:` URI for OG rendering.
 *
 * The record is attacker-controlled for any name, and this runs server-side on
 * the worker's egress, so every dereference goes through {@link safeFetch} —
 * see `safe-fetch.ts` for the guards and WEB-672 for the residual risk.
 *
 * `selfHost` is the worker's own host, rejected so an avatar pointing back at
 * `/og/<name>.png` can't make the worker recurse into itself.
 */
export async function resolveAvatarDataUri(
  client: EnsClient,
  avatarRecord: string,
  selfHost?: string,
): Promise<string | null> {
  try {
    const resolved = await resolveAvatarRecord(client, avatarRecord, selfHost)

    // On-chain avatars (data:/base64 SVGs etc.) are already inline — pass them
    // through without re-fetching (fetching a huge data: URI is itself abusable).
    // Still enforce the image/* requirement on the embedded MIME type.
    if (resolved.kind === 'inline') {
      return resolved.uri.startsWith('data:image/') ? resolved.uri : null
    }

    const result = await safeFetch(resolved.url, {
      accept: (contentType) => contentType.startsWith('image/'),
      maxBytes: AVATAR_MAX_BYTES,
      selfHost,
    })
    if (!result) return null

    return `data:${result.contentType};base64,${bytesToBase64(result.bytes)}`
  } catch {
    return null
  }
}

/**
 * Resolve the owner of an ENS name (V2 subname-aware, with V1 fallback).
 *
 * Thin wrapper over the shared {@link resolveEnsOwner} used by the React app
 * (useEnsOwner), returning just the owner address (or `null`) for OG rendering.
 */
export async function resolveOwner(
  client: EnsClient,
  name: string,
): Promise<string | null> {
  const result = await resolveEnsOwner(client, name).catch(() => null)
  return result ? result.owner : null
}

/** EIP-1967 implementation slot — mirrors `useIsPermissionedResolver`. */
const EIP1967_IMPLEMENTATION_SLOT: Hex =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

/**
 * Determine whether a resolver is an ENS Permissioned Resolver, so the OG card
 * can render the "Permissioned Resolver" subtitle.
 *
 * Worker-side mirror of {@link useIsPermissionedResolver}: read the EIP-1967
 * implementation slot and compare against the known permissioned-resolver
 * implementation for the chain. Any failure resolves to `false` so the card
 * still renders (just as a plain "Resolver").
 */
export async function fetchIsPermissionedResolver(
  env: Env,
  address: string,
): Promise<boolean> {
  try {
    const client = createClient(env)

    const knownImpl = getChainContractAddress({
      chain: client.chain,
      contract: 'ensPermissionedResolverImpl',
    })?.toLowerCase()
    if (!knownImpl) return false

    const normalized = address.toLowerCase()
    if (normalized === knownImpl) return true

    const slotValue = await getStorageAt(client, {
      address: address as Address,
      slot: EIP1967_IMPLEMENTATION_SLOT,
    })

    const implementation = decodeImplementationAddress(slotValue)
    if (!implementation) return false

    return implementation.toLowerCase() === knownImpl
  } catch {
    return false
  }
}

export async function fetchEnsData(
  env: Env,
  name: string,
  selfHost?: string,
): Promise<EnsData> {
  const client = createClient(env)
  try {
    const [records, owner] = await Promise.all([
      getRecords(client, {
        name,
        texts: ['avatar', 'description'],
      }).catch(() => null),
      resolveOwner(client, name),
    ])

    if (!records) {
      return {
        avatar: null,
        description: null,
        owner,
      }
    }

    const avatarRecord =
      records.texts.find((r) => r.key === 'avatar')?.value ?? null

    const avatar = avatarRecord
      ? await resolveAvatarDataUri(client, avatarRecord, selfHost)
      : null

    return {
      avatar,
      description:
        records.texts.find((r) => r.key === 'description')?.value ?? null,
      owner,
    }
  } catch {
    return { avatar: null, description: null, owner: null }
  }
}
