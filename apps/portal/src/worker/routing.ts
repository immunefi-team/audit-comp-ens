import { truncateAddress } from '../utils/formatting/truncateAddress'

export const STATIC_PATH_PREFIXES = [
  '/assets/',
  '/og/',
  '/addr/',
  '/favicon',
  '/manifest',
  '/logo',
] as const

/**
 * Reserved top-level route segments that are app pages, not ENS names.
 *
 * These have their own dedicated routes (e.g. `/resolver/$address`,
 * `/registry/$address`, `/register`) and must never be resolved as ENS names —
 * otherwise the OG renderer fetches them as names and produces nonsense like an
 * "Available to register" card for the literal label "resolver".
 *
 * `addr` and `tld` are also reserved but already excluded via
 * {@link STATIC_PATH_PREFIXES} and the dedicated `/tld/` handling respectively.
 */
export const RESERVED_ROUTE_SEGMENTS = new Set([
  'addr',
  'register',
  'registry',
  'resolver',
  'tld',
])

export function isAddressRoute(pathname: string): boolean {
  const match = pathname.match(/^\/addr\/(0x[0-9a-fA-F]{40})$/)
  return !!match
}

export function isAddrSubpage(pathname: string): boolean {
  const match = pathname.match(/^\/addr\/(0x[0-9a-fA-F]{40})\/[^/]+$/)
  return !!match
}

export function extractAddrFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/addr\/(0x[0-9a-fA-F]{40})/)
  return match ? match[1] : null
}

/**
 * Match an address-keyed contract route (`/resolver/0x…`, `/registry/0x…`) and
 * pull out the address plus any subpage.
 *
 * Returns `null` when the path isn't a `segment/0x{40}` route so callers can
 * fall through to the next handler.
 */
export function matchContractRoute(
  pathname: string,
  segment: string,
): { address: string; subpage: string | null } | null {
  const match = pathname.match(
    new RegExp(`^/${segment}/(0x[0-9a-fA-F]{40})(?:/(.+))?$`),
  )
  if (!match) return null
  return { address: match[1], subpage: match[2] ?? null }
}

export function isResolverRoute(pathname: string): boolean {
  return matchContractRoute(pathname, 'resolver') !== null
}

export function isRegistryRoute(pathname: string): boolean {
  return matchContractRoute(pathname, 'registry') !== null
}

export function isTldRoute(pathname: string): boolean {
  return pathname.startsWith('/tld/')
}

export function extractTldFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/tld\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Extract the ENS name a `/register` page is previewing.
 *
 * The register page carries its target name in the `?name=` query string
 * (e.g. `/register?name=foo.eth`), not the path — so it's excluded from
 * {@link extractNameFromPath} as a reserved segment (WEB-509). When a valid
 * `.eth` name is present we still want the OG card to show that name's
 * "Available to register" preview instead of the generic default.
 *
 * Returns the trimmed name when `pathname` is the register route and `name`
 * is a registerable second-level `.eth` name (`label.eth`), otherwise `null`.
 */
export function extractRegisterName(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname !== '/register' && pathname !== '/register/') return null

  const raw = searchParams.get('name')?.trim()
  if (!raw || raw === '.eth') return null
  if (!raw.endsWith('.eth')) return null

  // Only 2nd-level `.eth` names are registerable here (`label.eth`). Subnames
  // (`sub.label.eth`) pass the suffix check but the register route can't service
  // them: subname issuance is permissioned (only the 2LD owner can mint them)
  // and a subregistry may not even be enabled, so there's no generic register
  // action to preview. See `isRegistrable`/`is2LD`.
  if (raw.split('.').length !== 2) return null

  return raw
}

export function extractNameFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/')) return null
  const segments = pathname.slice(1).split('/')
  if (segments.length < 1 || segments[0] === '') return null

  const name = segments[0]

  for (const prefix of STATIC_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return null
  }

  if (name.includes('.') && !name.endsWith('.eth')) return null

  if (RESERVED_ROUTE_SEGMENTS.has(name)) return null

  return name
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

export { truncateAddress }
