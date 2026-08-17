// Auth: "Sign in with Linear" (OAuth2) → identity + authorization.
// - Hand-rolled HS256 JWT (no extra deps) for the DQA session.
// - The user's Linear access token is AES-256-GCM encrypted and embedded INSIDE the
//   JWT, so the server stays stateless (no DB) yet can post comments as the user.
//   The browser only ever holds ciphertext it cannot read.
// - Dev fallback issues a session without Linear when OAuth isn't configured.
import crypto from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import type { LinearViewer, Session } from './types.ts'

// Cap every outbound Linear request so an upstream outage can't hang a DQA
// request (auth callback, /api/comments deletion check, push, etc.) forever.
const LINEAR_FETCH_TIMEOUT_MS = 10_000

const LINEAR_AUTHORIZE = 'https://linear.app/oauth/authorize'
const LINEAR_TOKEN = 'https://api.linear.app/oauth/token'
const LINEAR_GQL = 'https://api.linear.app/graphql'
const LINEAR_REVOKE = 'https://api.linear.app/oauth/revoke'

// ---- config (read lazily so .env changes are picked up) ----------------
export function cfg() {
  return {
    clientId: process.env.LINEAR_CLIENT_ID || '',
    clientSecret: process.env.LINEAR_CLIENT_SECRET || '',
    redirectUri: process.env.LINEAR_REDIRECT_URI || '',
    // `write` is needed for screenshot uploads (fileUpload mutation) and
    // sub-issue/triage creation; `comments:create` alone can only comment.
    scopes: process.env.LINEAR_SCOPES || 'read,write',
    actor: process.env.LINEAR_ACTOR || 'user',
    workspaceId: process.env.LINEAR_WORKSPACE_ID || '',
    allowedTeamIds: (process.env.LINEAR_ALLOWED_TEAM_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    allowedProjectIds: (process.env.LINEAR_ALLOWED_PROJECT_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    devAllowed: (process.env.DQA_DEV_AUTH || '').toLowerCase() === 'true',
    allowedOrigins: (process.env.DQA_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

/**
 * Origin allowlist for CORS, OAuth return redirects, postMessage targets, and
 * WebSocket connections. Prevents a crafted `?returnUrl=` from exfiltrating a
 * freshly-minted session token to an attacker origin.
 *
 * - If DQA_ALLOWED_ORIGINS is set, only those exact origins are allowed.
 * - Otherwise (local dev), private/loopback origins are allowed so the LAN
 *   workflow keeps working without configuration.
 *
 * Entries may use `*` as a wildcard (matches any run of characters), so PR
 * previews on dynamically-named hosts work with a single entry, e.g.
 * `https://*.workers.dev` or `https://pr-*.preview.ens.dev`.
 */
function originMatches(pattern: string, origin: string): boolean {
  if (!pattern.includes('*')) return pattern === origin
  const re = new RegExp(
    '^' +
      pattern
        .split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  )
  return re.test(origin)
}
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false
  const list = cfg().allowedOrigins
  if (list.length) return list.some((p) => originMatches(p, origin))
  try {
    const { hostname, protocol } = new URL(origin)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    )
  } catch {
    return false
  }
}

/** Origin of a URL if it's an allowed origin, else null. */
export function safeOrigin(url: unknown): string | null {
  try {
    const o = new URL(String(url)).origin
    return isAllowedOrigin(o) ? o : null
  } catch {
    return null
  }
}

/** A return URL only if its origin is allowlisted, else null. */
export function safeReturnUrl(url: unknown): string | null {
  return safeOrigin(url) ? String(url) : null
}
/**
 * Delegated auth for ephemeral deployments (e.g. per-PR Railway envs):
 * DQA_AUTH_URL points at a long-lived instance whose domain is registered as
 * the Linear OAuth redirect URI. The overlay opens sign-in popups against that
 * origin and trusts its postMessages. Sessions it mints are valid here because
 * both instances share SESSION_SECRET (and TOKEN_ENCRYPTION_KEY) — set both
 * explicitly, or each instance auto-generates its own and delegation breaks.
 */
export function authOrigin(): string | null {
  const raw = process.env.DQA_AUTH_URL || ''
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    console.warn(`[auth] DQA_AUTH_URL is not a valid URL: ${raw}`)
    return null
  }
}

export function oauthConfigured() {
  const c = cfg()
  return !!(c.clientId && c.clientSecret && c.redirectUri)
}
// Dev login allowed when explicitly enabled, OR when OAuth simply isn't set up yet.
export function devAllowed() {
  return cfg().devAllowed || !oauthConfigured()
}

// ---- secrets -----------------------------------------------------------
let _sessionSecret = process.env.SESSION_SECRET
if (!_sessionSecret) {
  _sessionSecret = crypto.randomBytes(32).toString('hex')
  console.warn(
    '[auth] SESSION_SECRET not set — generated a temporary one (sessions reset on restart).',
  )
}
const SESSION_SECRET = _sessionSecret
const ENC_KEY = crypto
  .createHash('sha256')
  .update(process.env.TOKEN_ENCRYPTION_KEY || SESSION_SECRET)
  .digest() // always 32 bytes

// ---- base64url + JWT (HS256) ------------------------------------------
const b64url = (buf: Buffer | string): string => {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
const b64urlDecode = (str: string): Buffer =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function signJWT(
  payload: Record<string, unknown>,
  expSec = 60 * 60 * 12,
): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expSec,
    }),
  )
  const data = `${header}.${body}`
  const sig = b64url(
    crypto.createHmac('sha256', SESSION_SECRET).update(data).digest(),
  )
  return `${data}.${sig}`
}

// Generic over the payload shape: sessions decode as `Session` (default),
// OAuth round-trips as `OAuthState`. Signature + expiry are verified the same
// way regardless of shape.
export function verifyJWT<T = Session>(token: unknown): T | null {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3)
    return null
  const [header, body, sig] = token.split('.')
  const expected = b64url(
    crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest(),
  )
  const sigBuf = Buffer.from(sig),
    expBuf = Buffer.from(expected)
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  )
    return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(b64urlDecode(body).toString())
  } catch {
    return null
  }
  const exp = payload.exp
  if (typeof exp === 'number' && exp < Math.floor(Date.now() / 1000))
    return null
  return payload as T
}

// ---- AES-256-GCM for the embedded Linear token -------------------------
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const ct = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, ct].map((b) => b.toString('base64')).join('.')
}
export function decrypt(blob: string | null | undefined): string | null {
  if (!blob) return null
  try {
    const [iv, tag, ct] = blob.split('.').map((s) => Buffer.from(s, 'base64'))
    const d = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ---- OAuth flow --------------------------------------------------------
export function buildAuthorizeUrl(state: string): string {
  const c = cfg()
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: c.scopes,
    state,
    actor: c.actor,
    // Always show the consent screen: prevents Linear from silently reusing a
    // previous grant minted with narrower scopes (e.g. before `write` was
    // required for screenshot uploads).
    prompt: 'consent',
  })
  return `${LINEAR_AUTHORIZE}?${p.toString()}`
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}> {
  const c = cfg()
  const body = new URLSearchParams({
    code,
    redirect_uri: c.redirectUri,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'authorization_code',
  })
  const res = await fetch(LINEAR_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`token exchange failed (${res.status})`)
  return res.json() as Promise<{
    access_token: string
    token_type: string
    expires_in: number
    scope: string
  }>
}

// Generic over the caller-declared response shape; each caller supplies the
// GraphQL selection's type so no `any` leaks out.
async function gql<T>(
  query: string,
  token: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LINEAR_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
  })
  const json = (await res.json()) as { data?: T; errors?: unknown }
  if (json.errors)
    throw new Error('Linear GraphQL: ' + JSON.stringify(json.errors))
  return json.data as T
}

export async function fetchViewer(token: string): Promise<LinearViewer> {
  const data = await gql<{ viewer: LinearViewer }>(
    `{ viewer { id name email avatarUrl organization { id name urlKey }
        teamMemberships { nodes { team { id key name } } } } }`,
    token,
  )
  return data.viewer
}

// Returns { ok, reason }. Order: workspace → team → project.
export async function checkWhitelist(
  viewer: LinearViewer,
  token: string,
): Promise<{ ok: boolean; reason?: string }> {
  const c = cfg()
  if (c.workspaceId && viewer.organization?.id !== c.workspaceId) {
    return {
      ok: false,
      reason: "Your Linear workspace isn't authorized for DQA.",
    }
  }
  if (c.allowedTeamIds.length) {
    const teams = (viewer.teamMemberships?.nodes || []).map((n) => n.team.id)
    if (!teams.some((t) => c.allowedTeamIds.includes(t))) {
      return { ok: false, reason: "You're not on a team with DQA access." }
    }
  }
  if (c.allowedProjectIds.length) {
    const data = await gql<{ projects?: { nodes?: unknown[] } }>(
      `query($ids:[ID!],$uid:ID){ projects(filter:{ id:{ in:$ids }, members:{ id:{ eq:$uid } } }){ nodes { id } } }`,
      token,
      { ids: c.allowedProjectIds, uid: viewer.id },
    ).catch(() => ({ projects: { nodes: [] } }))
    if (!(data.projects?.nodes || []).length) {
      return {
        ok: false,
        reason: "You're not a member of a project with DQA access.",
      }
    }
  }
  return { ok: true }
}

export async function revoke(token: string): Promise<void> {
  try {
    await fetch(LINEAR_REVOKE, {
      method: 'POST',
      headers: { Authorization: token },
      signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
    })
  } catch {}
}

// ---- session helpers ---------------------------------------------------
export function colorFor(id: string): string {
  const COLORS = [
    '#111827',
    '#2563eb',
    '#0f766e',
    '#7c3aed',
    '#be123c',
    '#b45309',
  ]
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

// Build the DQA session JWT from a Linear viewer + token.
export function makeSession(viewer: LinearViewer, linearToken: string): string {
  return signJWT({
    sub: viewer.id,
    name: viewer.name,
    email: viewer.email || null,
    orgId: viewer.organization?.id || null,
    color: colorFor(viewer.id),
    avatarUrl: viewer.avatarUrl || null,
    lt: encrypt(linearToken), // encrypted Linear access token (server-only)
    dev: false,
  })
}

// Auto-numbered default names so each browser/session in dev mode shows up as
// a distinct user ("Dev 1", "Dev 2", …). Resets on server restart — fine.
let devSeq = 0

export function makeDevSession(name: string): string {
  devSeq += 1
  const label = (name || '').trim() || `Dev ${devSeq}`
  // Random id per session (NOT a hash of the name): two browsers using the
  // same/default name must still be separate users for presence/cursors.
  const id = 'dev-' + crypto.randomBytes(3).toString('hex')
  return signJWT({
    sub: id,
    name: label,
    email: null,
    orgId: null,
    color: colorFor(id),
    avatarUrl: null,
    lt: null,
    dev: true,
  })
}

// Read + verify a Bearer token from an Authorization header. Returns payload or null.
export function sessionFromAuthHeader(
  header: string | undefined,
): Session | null {
  const m = (header || '').match(/^Bearer\s+(.+)$/i)
  return m ? verifyJWT(m[1]) : null
}

/**
 * Hono env for gated routes: `c.get('session')` is the verified DQA session.
 * The app is typed with this throughout, so only routes that actually mount
 * `requireAuth` have a session at runtime.
 */
export type AuthEnv = { Variables: { session: Session } }

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const s = sessionFromAuthHeader(c.req.header('authorization'))
  if (!s) return c.json({ error: 'auth required' }, 401)
  c.set('session', s)
  await next()
})
