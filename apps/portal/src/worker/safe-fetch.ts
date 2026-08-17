/**
 * Guarded outbound fetch for attacker-controlled URLs (WEB-672).
 *
 * An ENS `avatar` text record is an arbitrary URL under the control of whoever
 * owns the name, and the OG-image worker dereferences it server-side. We can't
 * gate that on a host allowlist — people legitimately self-host avatars on their
 * own domains — so instead we harden *how* the request is made:
 *
 * - `https:` only (parity with the `img-src 'self' data: blob: https:` CSP, so
 *   `http:` avatars already don't render in-app either)
 * - no `user:pass@` credentials
 * - no IP-literal hosts at all, public ones included — see {@link isIpLiteral}
 * - redirects followed manually, re-validating every hop
 * - shared deadline, size cap, and Content-Type check on the final response
 *
 * Redirect handling is the load-bearing part: `fetch()` follows redirects by
 * default, so validating only the initial URL is trivially bypassed by pointing
 * an allowed host at a `302`.
 *
 * Note this is defence-in-depth, not a hard boundary. Cloudflare's egress
 * already refuses to route to RFC1918, and by design this still permits fetches
 * to arbitrary *public* https endpoints — that capability is inherent to
 * supporting self-hosted avatars. See WEB-672 for the accepted residual risk.
 */

import { concatBytes } from 'viem/utils'

/** Abort the whole request (including redirect hops) if the upstream hangs. */
const DEFAULT_TIMEOUT_MS = 20_000
/** Redirect hops to follow before giving up. */
const MAX_REDIRECTS = 3

type UrlRejection =
  | 'malformed'
  | 'scheme'
  | 'credentials'
  | 'ip-literal'
  | 'self-host'

/**
 * Reject IP-literal hosts outright — public ones included.
 *
 * Only reserved ranges (loopback, RFC1918, link-local metadata …) are an actual
 * SSRF concern, but enumerating them means carrying a CIDR table that has to
 * track every future reservation and every address-encoding quirk, and getting
 * a range subtly wrong fails *open*. A blanket rule can't.
 *
 * The cost is negligible: an ENS `avatar` is a URL a human pasted, and those
 * point at hostnames. Serving one from a bare IP over https is possible — IP
 * certificates exist, `https://1.1.1.1/` validates today — but it means
 * obtaining an IP-SAN certificate and then choosing not to put a name in front
 * of it. Reserved IPs can't clear that bar at all, since CAs are barred from
 * issuing for them.
 */
function isIpLiteral(hostname: string): boolean {
  // IPv6 literals are always bracketed in a URL host.
  if (hostname.startsWith('[')) return true

  // The WHATWG URL parser normalises anything IPv4-shaped to dotted-quad
  // (`2130706433`, `0x7f.1`, `017700000001`, `127.1`, `12.34`) and *throws* on
  // malformed attempts like `999.1.1.1`. So a hostname that parsed and matches
  // this shape is definitively an IPv4 literal, obfuscated forms included.
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

/**
 * Validate a single URL before it is dereferenced. Returns `null` when the URL
 * is safe to fetch, or the reason it was rejected.
 *
 * `selfHost` is the worker's own host: an avatar pointing back at `/og/<name>`
 * would make the worker recurse into itself, with each hop spawning a fresh
 * invocation.
 */
function checkFetchableUrl(
  raw: string,
  selfHost?: string,
): UrlRejection | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'malformed'
  }

  if (url.protocol !== 'https:') return 'scheme'
  if (url.username || url.password) return 'credentials'
  if (isIpLiteral(url.hostname)) return 'ip-literal'
  if (selfHost && url.host.toLowerCase() === selfHost.toLowerCase()) {
    return 'self-host'
  }

  return null
}

/**
 * Read a response body into a buffer, aborting once `maxBytes` is exceeded.
 *
 * Returning early from `for await` triggers the iterator's `return()`, which
 * cancels the underlying stream — an oversized upstream gets disconnected
 * rather than drained and discarded. workerd declares `[Symbol.asyncIterator]`
 * on `ReadableStream` with `preventCancel` defaulting to false, so that holds
 * in the Workers runtime and not only under the test environment's streams.
 *
 * Deliberately not `Array.fromAsync`: it buffers the whole stream with no way
 * to bail partway, which is precisely the cap this function exists to enforce.
 */
async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!res.body) return null

  const chunks: Uint8Array[] = []
  let total = 0

  for await (const chunk of res.body) {
    total += chunk.byteLength
    if (total > maxBytes) return null
    chunks.push(chunk)
  }

  return concatBytes(chunks)
}

/** Strip parameters (`; charset=…`) and normalise a Content-Type for matching. */
function baseContentType(header: string | null): string | null {
  if (!header) return null
  const base = header.split(';')[0]?.trim().toLowerCase()
  return base || null
}

export interface SafeFetchOptions {
  /** Predicate the upstream's (parameter-stripped) Content-Type must satisfy. */
  readonly accept: (contentType: string) => boolean
  /** Maximum response body size, in bytes. */
  readonly maxBytes: number
  /** Deadline shared across every redirect hop. */
  readonly timeoutMs?: number
  /** The worker's own host, rejected to prevent self-recursion. */
  readonly selfHost?: string
}

export interface SafeFetchResult {
  /**
   * Note `readonly` pins the reference, not the buffer — the bytes themselves
   * are still mutable. Callers must not write through it.
   */
  readonly bytes: Uint8Array
  readonly contentType: string
}

/**
 * Resolve a 3xx response's `Location` against the URL that produced it.
 *
 * Returns `null` when the response isn't a redirect, or is one we won't follow
 * (missing or unparseable `Location`).
 */
function nextRedirectUrl(res: Response, current: string): string | null {
  if (res.status < 300 || res.status >= 400) return null

  const location = res.headers.get('location')
  if (!location) return null

  try {
    // `Location` may be relative; the caller re-validates the result.
    return new URL(location, current).toString()
  } catch {
    return null
  }
}

/** Validate a final (non-redirect) response and read its body under the cap. */
async function readAcceptable(
  res: Response,
  accept: (contentType: string) => boolean,
  maxBytes: number,
): Promise<SafeFetchResult | null> {
  if (!res.ok) return null

  const contentType = baseContentType(res.headers.get('content-type'))
  if (!contentType || !accept(contentType)) return null

  const bytes = await readCapped(res, maxBytes)
  if (!bytes) return null

  return { bytes, contentType }
}

/**
 * Fetch a URL under the guards described in the module docblock.
 *
 * Returns `null` for every failure mode — rejected URL, redirect loop, non-2xx,
 * unacceptable Content-Type, oversized body, timeout. Callers treat a missing
 * avatar as "render the card without one", so there's nothing useful to
 * distinguish; surfacing the reason would also hand the caller an oracle.
 */
export async function safeFetch(
  rawUrl: string,
  {
    accept,
    maxBytes,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    selfHost,
  }: SafeFetchOptions,
): Promise<SafeFetchResult | null> {
  // One signal for all hops: a per-hop timeout would let a redirect chain
  // multiply the budget (MAX_REDIRECTS × timeoutMs).
  const signal = AbortSignal.timeout(timeoutMs)
  let current = rawUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (checkFetchableUrl(current, selfHost)) return null

    const res = await fetch(current, { redirect: 'manual', signal })
    const redirect = nextRedirectUrl(res, current)

    if (!redirect) return readAcceptable(res, accept, maxBytes)
    current = redirect
  }

  return null // too many redirects
}
