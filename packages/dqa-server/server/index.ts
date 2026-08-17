import './load-env.ts' // must be first — populates process.env before other modules read it
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAdaptorServer } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { type Context, Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { WebSocketServer } from 'ws'

import {
  type AuthEnv,
  authOrigin,
  buildAuthorizeUrl,
  checkWhitelist,
  decrypt,
  devAllowed,
  exchangeCode,
  fetchViewer,
  isAllowedOrigin,
  makeDevSession,
  makeSession,
  oauthConfigured,
  requireAuth,
  revoke,
  safeOrigin,
  safeReturnUrl,
  signJWT,
  verifyJWT,
} from './auth.ts'
import {
  addComment,
  addReply,
  listComments,
  removeComment,
  updateComment,
} from './db.ts'
import {
  checkLinearStatus,
  pushReplyToLinear,
  pushToLinear,
  searchIssues,
} from './linear.ts'
import type {
  Anchor,
  Comment,
  Inspect,
  OAuthState,
  StyleEdit,
} from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 4000
const PUBLIC_DIR = resolve(__dirname, '../public')
// Vite output: overlay.js plus its lazily-imported chunks (see vite.config.ts).
// Served ahead of PUBLIC_DIR so the public URL stays /overlay.js. Built in the
// Docker build stage; run `pnpm build` before `pnpm start` locally.
const DIST_DIR = resolve(__dirname, '../dist')
const UPLOAD_DIR = resolve(__dirname, '../data/uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

const app = new Hono<AuthEnv>()

// CORS: reflect the request origin only when it's on the allowlist. Auth is
// Bearer-token (never cookies), so we never send credentials; an un-allowed
// origin simply gets no CORS headers and the browser blocks the response.
app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.onError((err, c) => {
  console.error('[http]', c.req.method, c.req.path, err)
  return c.json({ error: 'internal error' }, 500)
})

// Request-body ceilings. JSON bodies carry screenshot metadata, so 2mb;
// /api/upload gets its own, larger limit below.
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const tooLarge = (c: Context) => c.json({ error: 'payload too large' }, 413)
const jsonLimit = bodyLimit({ maxSize: MAX_JSON_BYTES, onError: tooLarge })

/** Body of a JSON request, or `{}` when absent/unparseable (matches the old `req.body || {}`). */
async function readJson<T>(c: Context): Promise<Partial<T>> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : {}
  } catch {
    return {}
  }
}

// Uploads: images only, with a server-forced safe extension. Prevents an
// attacker uploading e.g. .html and having it served (as text/html) from the
// DQA origin — the filename never derives from client input.
const ALLOWED_IMAGE_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

// Built from the Host header and the scheme this process was actually reached
// on — `x-forwarded-proto` is deliberately not trusted, so a TLS-terminating
// proxy needs the public URL configured on its side rather than inferred here.
const baseUrl = (c: Context): string => new URL(c.req.url).origin
const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  )

// ======================================================================
//  AUTH
// ======================================================================

app.get('/auth/config', (c) => {
  // authOrigin: delegated-auth instance the overlay should open sign-in
  // popups against (and trust postMessages from). Ephemeral deployments set
  // DQA_AUTH_URL to a long-lived instance whose domain is the registered
  // Linear redirect URI; its sessions are valid here via shared secrets.
  return c.json({
    oauthConfigured: oauthConfigured() || !!authOrigin(),
    devAllowed: devAllowed(),
    authOrigin: authOrigin(),
  })
})

// Resolve + validate the caller-supplied origin/returnUrl against the
// allowlist so a crafted `?returnUrl=` can never redirect the token elsewhere.
function resolveReturn(c: Context): {
  origin: string | null
  returnUrl: string | null
} {
  const referer = c.req.header('referer')
  const origin = safeOrigin(c.req.query('origin')) || safeOrigin(referer)
  const returnUrl =
    safeReturnUrl(c.req.query('returnUrl')) ||
    safeReturnUrl(referer) ||
    (origin ? `${origin}/demo.html` : null)
  return { origin, returnUrl }
}

// If this instance can't complete OAuth itself but delegates to another
// (DQA_AUTH_URL), forward auth entrypoints there with the query intact — the
// popup-blocked fallback navigates the page here directly, bypassing the
// overlay's own authOrigin handling. Returns the redirect, or null when this
// instance should handle the request itself.
function delegateAuth(c: Context): Response | null {
  const remote = authOrigin()
  if (oauthConfigured() || !remote) return null
  return c.redirect(`${remote}${c.req.path}${new URL(c.req.url).search}`)
}

app.get('/auth/linear', (c) => {
  const delegated = delegateAuth(c)
  if (delegated) return delegated
  if (!oauthConfigured()) return c.text('Linear OAuth is not configured.', 400)
  const { origin, returnUrl } = resolveReturn(c)
  if (!origin)
    return c.text('Origin not allowed. Set DQA_ALLOWED_ORIGINS.', 400)
  const state = signJWT({ origin, returnUrl, n: randomUUID() }, 600)
  return c.redirect(buildAuthorizeUrl(state))
})

/** Popup helper when the user needs to log out of Linear and sign in with another account. */
app.get('/auth/account-switch', (c) => {
  const delegated = delegateAuth(c)
  if (delegated) return delegated
  if (!oauthConfigured()) return c.text('Linear OAuth is not configured.', 400)
  const { origin, returnUrl } = resolveReturn(c)
  if (!origin)
    return c.text('Origin not allowed. Set DQA_ALLOWED_ORIGINS.', 400)
  const state = signJWT({ origin, returnUrl, n: randomUUID() }, 600)
  const loginUrl = buildAuthorizeUrl(state)
  return c.html(`<!doctype html><meta charset=utf-8>
<title>Switch Linear account</title>
<body style="font:14px -apple-system,BlinkMacSystemFont,sans-serif;padding:24px;max-width:420px;color:#111827;line-height:1.5">
<h1 style="font-size:18px;margin:0 0 8px">Switch Linear account</h1>
<p style="color:#6b7280;margin:0 0 16px">If access was denied, log out of Linear first, then sign in with an authorized account.</p>
<ol style="padding-left:20px;margin:0 0 20px">
<li style="margin-bottom:12px"><a href="https://linear.app/logout" style="color:#2563eb;font-weight:600">Log out of Linear</a></li>
<li><a href="${esc(loginUrl)}" style="color:#2563eb;font-weight:600">Sign in with Linear</a></li>
</ol>
<p style="color:#6b7280;font-size:12px;margin:0">You can close this window after signing in.</p>
<script>
try { localStorage.removeItem("dqa_token"); } catch (e) {}
</script>
</body>`)
})

function popupResult(
  c: Context,
  payload: { token?: string; error?: string },
  targetOrigin: string | null,
  returnUrl: string | null,
): Response {
  // targetOrigin/returnUrl are pre-validated against the allowlist by callers.
  // Never fall back to "*": that would broadcast the token to any opener.
  return c.html(`<!doctype html><meta charset=utf-8>
<body style="font:14px -apple-system,sans-serif;padding:24px;color:#111827">
${payload.token ? 'Signed in. Returning…' : 'Access denied: ' + esc(payload.error || '')}
<script>
(function () {
  var payload = ${JSON.stringify(payload)};
  var targetOrigin = ${JSON.stringify(targetOrigin || '')};
  var returnUrl = ${JSON.stringify(returnUrl || targetOrigin || '/')};
  if (!targetOrigin) { document.body.append(" (no allowed return origin)"); return; }
  if (payload.token) {
    try { localStorage.setItem("dqa_token", payload.token); } catch (e) {}
  }
  try { window.opener && window.opener.postMessage(payload, targetOrigin); } catch (e) {}
  if (window.opener) {
    setTimeout(function () { window.close(); }, ${payload.token ? 300 : 4000});
  } else {
    location.replace(returnUrl);
  }
})();
</script></body>`)
}

app.get('/auth/callback', async (c) => {
  const code = c.req.query('code') ?? ''
  const st = verifyJWT<OAuthState>(c.req.query('state'))
  if (!code || !st)
    return popupResult(c, { error: 'invalid state' }, null, null)
  // Re-validate the state's origin/returnUrl at redemption: the token is only
  // ever posted to / redirected to an allowlisted origin, never a bare "*".
  const origin = safeOrigin(st.origin)
  const returnUrl = safeReturnUrl(st.returnUrl)
  if (!origin)
    return popupResult(c, { error: 'origin not allowed' }, null, null)
  try {
    const tok = await exchangeCode(code)
    const viewer = await fetchViewer(tok.access_token)
    const gate = await checkWhitelist(viewer, tok.access_token)
    if (!gate.ok)
      return popupResult(c, { error: gate.reason }, origin, returnUrl)
    const token = makeSession(viewer, tok.access_token)
    return popupResult(c, { token }, origin, returnUrl)
  } catch (e) {
    console.error('[auth] callback', (e as Error).message)
    return popupResult(c, { error: 'sign-in failed' }, origin, returnUrl)
  }
})

// Dev login — only when OAuth isn't configured or DQA_DEV_AUTH=true.
app.get('/auth/dev', (c) => {
  if (!devAllowed()) return c.json({ error: 'dev auth disabled' }, 403)
  return c.json({
    // Empty name → server auto-assigns "Dev N" (unique per session).
    token: makeDevSession((c.req.query('name') ?? '').slice(0, 40)),
  })
})

app.post('/auth/logout', requireAuth, async (c) => {
  const lt = decrypt(c.get('session').lt)
  if (lt) await revoke(lt)
  return c.json({ ok: true })
})

// who am I (handy for the overlay to validate its token)
app.get('/auth/me', requireAuth, (c) => {
  const { sub, name, email, color, orgId, dev, avatarUrl } = c.get('session')
  return c.json({
    id: sub,
    name,
    email,
    color,
    orgId,
    dev,
    avatarUrl: avatarUrl || null,
  })
})

// ======================================================================
//  API  (all gated)
// ======================================================================

// How often we re-verify that pushed comments/issues still exist in Linear.
const LINEAR_CHECK_INTERVAL_MS = 60_000

// Distinct pages that have comments, with open/total counts — powers the
// DevDrawer "Pages" navigator.
app.get('/api/pages', requireAuth, (c) => {
  const byUrl = new Map<string, { url: string; open: number; total: number }>()
  for (const comment of listComments()) {
    const e = byUrl.get(comment.url) ?? { url: comment.url, open: 0, total: 0 }
    e.total += 1
    if (comment.status !== 'resolved') e.open += 1
    byUrl.set(comment.url, e)
  }
  return c.json(
    [...byUrl.values()].sort((a, b) => b.open - a.open || b.total - a.total),
  )
})

app.get('/api/comments', requireAuth, async (c) => {
  const pageUrl = c.req.query('url')
  const comments = listComments(pageUrl)
  // Lazily detect Linear-side deletions using the reviewer's token (no-op for
  // dev sessions). Throttled per comment; failures leave the state untouched.
  const token = decrypt(c.get('session').lt)
  if (token) {
    const now = Date.now()
    const due = comments.filter(
      (comment) =>
        comment.linear &&
        !comment.linearDeleted &&
        (!comment.linearCheckedAt ||
          now - comment.linearCheckedAt > LINEAR_CHECK_INTERVAL_MS),
    )
    await Promise.all(
      due.map(async (comment) => {
        const status = await checkLinearStatus(comment.linear, token)
        const updated = updateComment(comment.id, {
          linearCheckedAt: now,
          ...(status === 'deleted' ? { linearDeleted: true } : {}),
        })
        if (status === 'deleted' && updated)
          broadcast(comment.url, { type: 'comment:update', comment: updated })
      }),
    )
  }
  return c.json(listComments(pageUrl))
})

app.delete('/api/comments/:id', requireAuth, (c) => {
  const removed = removeComment(c.req.param('id'))
  if (!removed) return c.json({ error: 'not found' }, 404)
  broadcast(removed.url, { type: 'comment:delete', id: removed.id })
  return c.json({ ok: true })
})

// Cap client-supplied inspection payloads (component snapshot + style edits).
function sanitizeInspect(inspect: unknown): Inspect | null {
  if (!inspect || typeof inspect !== 'object') return null
  try {
    if (JSON.stringify(inspect).length > 8000) return null
  } catch {
    return null
  }
  const o = inspect as Record<string, unknown>
  return {
    tag: String(o.tag || '').slice(0, 40),
    id: o.id ? String(o.id).slice(0, 120) : null,
    classes: Array.isArray(o.classes)
      ? o.classes.slice(0, 60).map((c) => String(c).slice(0, 120))
      : [],
    styles:
      o.styles && typeof o.styles === 'object'
        ? Object.fromEntries(
            Object.entries(o.styles as Record<string, unknown>)
              .slice(0, 30)
              .map(([k, v]) => [
                String(k).slice(0, 60),
                String(v).slice(0, 200),
              ]),
          )
        : {},
    props:
      o.props && typeof o.props === 'object'
        ? Object.fromEntries(
            Object.entries(o.props as Record<string, unknown>)
              .slice(0, 30)
              .map(([k, v]) => [
                String(k).slice(0, 60),
                String(v).slice(0, 200),
              ]),
          )
        : null,
    componentPath: o.componentPath
      ? String(o.componentPath).slice(0, 200)
      : null,
    viewport: o.viewport ? String(o.viewport).slice(0, 60) : null,
    text: o.text ? String(o.text).slice(0, 120) : null,
  }
}
// A CSS value we're willing to persist / put in a Linear issue. Blocks tokens
// that could smuggle a payload (url() trackers, extra declarations, imports).
// The `class` edit carries a class list, which is checked with the same rule.
function isSafeCssValue(v: string): boolean {
  return (
    v.length <= 300 &&
    !/[<>{};]|url\(|expression|javascript:|@import|\\/i.test(v)
  )
}
// Cap free-text fields — bodies are rendered escaped everywhere, but there is
// no reason to store megabytes per comment (jsonLimit allows 2mb requests for
// screenshot metadata).
const MAX_BODY_LEN = 5_000
const MAX_URL_LEN = 2_000

function sanitizeAnchor(a: unknown): Anchor | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const selector = String(o.selector ?? '').slice(0, 500)
  if (!selector) return null
  const num = (v: unknown): number | undefined => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return {
    selector,
    label: o.label ? String(o.label).slice(0, 200) : undefined,
    offsetX: num(o.offsetX),
    offsetY: num(o.offsetY),
    pageXPct: num(o.pageXPct),
    pageYPct: num(o.pageYPct),
  }
}

function sanitizeStyleEdits(edits: unknown): StyleEdit[] | null {
  if (!Array.isArray(edits)) return null
  const out = edits
    .slice(0, 40)
    .map((e) => {
      const o = (e ?? {}) as Record<string, unknown>
      return {
        prop: String(o.prop ?? '').slice(0, 60),
        from: String(o.from ?? '').slice(0, 300),
        to: String(o.to ?? '').slice(0, 300),
      }
    })
    .filter((e) => {
      // prop must be a CSS property name or the literal "class".
      if (!/^(class|[a-z][a-z-]{0,59})$/.test(e.prop)) return false
      // The class list can't inject (escaped on display, code-fenced in Linear)
      // and legitimately contains `>` etc. in Tailwind arbitrary variants —
      // length-cap only. CSS *values* get the strict token check.
      if (e.prop === 'class') return true
      return isSafeCssValue(e.from) && isSafeCssValue(e.to)
    })
  return out.length ? out : null
}

app.post('/api/comments', requireAuth, jsonLimit, async (c) => {
  const {
    url,
    body,
    anchor,
    imageUrl,
    afterImageUrl,
    issueRef,
    inspect,
    styleEdits,
  } = await readJson<Record<string, unknown>>(c)
  if (!url || !body) return c.json({ error: 'url and body required' }, 400)
  // Server-hosted screenshots only — both image fields must point at our
  // own /uploads/ (same rule the "after" shot always had).
  const ownUpload = (v: unknown) =>
    typeof v === 'string' && v.startsWith('/uploads/') && v.length < 200
      ? v
      : null
  const session = c.get('session')
  const comment: Comment = {
    id: randomUUID(),
    url: String(url).slice(0, MAX_URL_LEN),
    author: session.name, // identity comes from the session, not the client
    authorId: session.sub,
    authorAvatar: session.avatarUrl || null,
    body: String(body).slice(0, MAX_BODY_LEN),
    anchor: sanitizeAnchor(anchor),
    imageUrl: ownUpload(imageUrl),
    // "after" element screenshot with suggested style edits applied
    afterImageUrl: ownUpload(afterImageUrl),
    issueRef: issueRef ? String(issueRef).slice(0, 40) : null, // e.g. "ENG-123"
    inspect: sanitizeInspect(inspect),
    styleEdits: sanitizeStyleEdits(styleEdits),
    status: 'open',
    replies: [],
    linear: null,
    createdAt: new Date().toISOString(),
  }
  addComment(comment)
  broadcast(comment.url, { type: 'comment:new', comment })
  return c.json(comment)
})

app.post('/api/comments/:id/reply', requireAuth, jsonLimit, async (c) => {
  const raw = await readJson<{ body: unknown }>(c)
  const body =
    typeof raw.body === 'string' ? raw.body.trim().slice(0, MAX_BODY_LEN) : ''
  if (!body) return c.json({ error: 'body required' }, 400)

  const id = c.req.param('id')
  // If the parent comment was already pushed to Linear, mirror the reply
  // there as a THREADED reply (parentId) so the conversation continues on
  // the ticket. Best-effort — the DQA reply saves regardless.
  const parent = listComments().find((comment) => comment.id === id)
  let linearSynced = false
  if (parent?.linear && !parent.linearDeleted) {
    const userToken = decrypt(c.get('session').lt) // null for dev sessions
    linearSynced = await pushReplyToLinear(parent.linear, body, userToken)
  }

  const updated = addReply(id, {
    id: randomUUID(),
    author: c.get('session').name,
    authorAvatar: c.get('session').avatarUrl || null,
    body,
    createdAt: new Date().toISOString(),
    linearSynced,
  })
  if (!updated) return c.json({ error: 'not found' }, 404)
  broadcast(updated.url, { type: 'comment:update', comment: updated })
  return c.json(updated)
})

app.post('/api/comments/:id/resolve', requireAuth, (c) => {
  const updated = updateComment(c.req.param('id'), { status: 'resolved' })
  if (!updated) return c.json({ error: 'not found' }, 404)
  broadcast(updated.url, { type: 'comment:update', comment: updated })
  return c.json(updated)
})

app.post(
  '/api/upload',
  requireAuth,
  bodyLimit({ maxSize: MAX_UPLOAD_BYTES, onError: tooLarge }),
  async (c) => {
    const file = (await c.req.parseBody()).image
    if (!(file instanceof File)) return c.json({ error: 'no file' }, 400)
    const ext = ALLOWED_IMAGE_EXT[file.type]
    if (!ext) return c.json({ error: 'unsupported image type' }, 400)
    const filename = randomUUID() + ext
    await writeFile(
      resolve(UPLOAD_DIR, filename),
      Buffer.from(await file.arrayBuffer()),
    )
    return c.json({ imageUrl: `/uploads/${filename}` })
  },
)

// Search the reviewer's Linear issues for the ticket picker.
app.get('/api/linear/issues', requireAuth, async (c) => {
  try {
    const userToken = decrypt(c.get('session').lt)
    const term = (c.req.query('term') ?? '').trim()
    const rawAfter = c.req.query('after')
    const after = rawAfter && rawAfter.length < 500 ? rawAfter : null
    const page = await searchIssues(term, userToken, after)
    return c.json({
      issues: page.issues,
      nextCursor: page.nextCursor,
      dev: !userToken,
    })
  } catch (e) {
    console.error('[linear] search', (e as Error).message)
    return c.json({ error: (e as Error).message }, 502)
  }
})

const PUSH_ACTIONS = ['comment', 'subissue', 'issue'] as const
type PushAction = (typeof PUSH_ACTIONS)[number]

app.post('/api/comments/:id/linear', requireAuth, jsonLimit, async (c) => {
  const id = c.req.param('id')
  const comment = listComments().find((entry) => entry.id === id)
  if (!comment) return c.json({ error: 'not found' }, 404)
  const body = await readJson<{
    issueRef: string
    action: string
    priority: number
  }>(c)
  // A ticket chosen in the picker overrides the page's default (?issue=).
  const issueRef = body.issueRef || comment.issueRef || null
  const action: PushAction | null = PUSH_ACTIONS.includes(
    body.action as PushAction,
  )
    ? (body.action as PushAction)
    : null
  const priority =
    typeof body.priority === 'number' &&
    Number.isInteger(body.priority) &&
    body.priority >= 0 &&
    body.priority <= 4
      ? body.priority
      : null
  try {
    const userToken = decrypt(c.get('session').lt) // reviewer's Linear token (actor=user)
    const result = await pushToLinear(
      { ...comment, issueRef },
      { userToken, baseUrl: baseUrl(c), action, priority },
    )
    const updated = updateComment(comment.id, {
      linear: result.issue,
      issueRef,
    })
    broadcast(comment.url, { type: 'comment:update', comment: updated })
    return c.json(result)
  } catch (e) {
    console.error('[linear]', (e as Error).message)
    return c.json({ error: (e as Error).message }, 502)
  }
})

// ======================================================================
//  STATIC
// ======================================================================

// serveStatic builds its Response before `onFound` runs, so headers set there
// are dropped. Setting them after `await next()` mutates the finalized
// response instead, which is the only thing that reaches the client.
const staticHeaders =
  (headers: Record<string, string>): MiddlewareHandler<AuthEnv> =>
  async (c, next) => {
    await next()
    if (c.res.status < 200 || c.res.status >= 300) return
    for (const [k, v] of Object.entries(headers)) c.header(k, v)
  }

// Screenshots. Filenames are unguessable UUIDs; served with a locked-down
// Content-Type + nosniff so a stored file can never execute as script/HTML.
app.use(
  '/uploads/*',
  staticHeaders({
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  }),
  serveStatic({
    root: UPLOAD_DIR,
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, ''),
  }),
)

// `no-cache` = browsers must revalidate (ETag/304) before reusing a cached
// copy, so overlay.js updates are picked up on refresh instead of a stale
// script silently serving until the heuristic cache expires.
//
// dist/ (built overlay bundle) is mounted first so it wins over anything of
// the same name in public/; public/ holds hand-authored static assets only.
app.use(
  '*',
  staticHeaders({ 'Cache-Control': 'no-cache' }),
  serveStatic({ root: DIST_DIR }),
  serveStatic({ root: PUBLIC_DIR }),
)

// ======================================================================
//  WebSocket — live cursors + presence (also gated)
// ======================================================================

// createAdaptorServer's return type is the http/http2 union; with no
// serverOptions it's a plain node:http Server, which is what `ws` attaches to.
const server = createAdaptorServer({ fetch: app.fetch }) as Server
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Reject cross-origin WS handshakes from non-allowlisted origins up front.
  // (Every message is still token-gated below; this is defence in depth.)
  verifyClient: (info: { origin?: string }) =>
    !info.origin || isAllowedOrigin(info.origin),
})
type PeerMeta = {
  url: string | null
  user: {
    id: string
    name: string
    color: string
    avatarUrl?: string | null
  } | null
  authed: boolean
}
type Peer = import('ws').WebSocket & { meta: PeerMeta }
const rooms = new Map<string, Set<Peer>>() // url -> peers

function broadcast(url: string, payload: unknown, except?: Peer): void {
  const peers = rooms.get(url)
  if (!peers) return
  const msg = JSON.stringify(payload)
  for (const ws of peers)
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(msg)
}

wss.on('connection', (rawWs) => {
  const ws = rawWs as Peer
  ws.meta = { url: null, user: null, authed: false }

  ws.on('message', (raw) => {
    let msg: {
      type?: string
      token?: unknown
      url?: string
      x?: number
      y?: number
    }
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (msg.type === 'join') {
      // identity + auth come from the verified token, never from client-supplied fields
      const session = verifyJWT(msg.token)
      if (!session || !msg.url) {
        ws.send(JSON.stringify({ type: 'unauthorized' }))
        return ws.close()
      }
      ws.meta.authed = true
      // On SPA navigation the client re-joins with a new url. Leave the old
      // room first so this socket stops receiving the previous page's cursor
      // events (otherwise it lingers in both rooms).
      if (ws.meta.url && ws.meta.url !== msg.url) {
        const prev = rooms.get(ws.meta.url)
        if (prev) {
          prev.delete(ws)
          broadcast(ws.meta.url, { type: 'leave', user: ws.meta.user })
          if (prev.size === 0) rooms.delete(ws.meta.url)
        }
      }
      ws.meta.url = msg.url
      ws.meta.user = {
        id: session.sub,
        name: session.name,
        color: session.color,
        avatarUrl: session.avatarUrl || null,
      }
      const room = rooms.get(msg.url) ?? new Set<Peer>()
      rooms.set(msg.url, room)
      room.add(ws)
      const others = [...room]
        .filter((p) => p !== ws && p.meta.user)
        .map((p) => p.meta.user)
      ws.send(JSON.stringify({ type: 'presence', users: others }))
      broadcast(msg.url, { type: 'join', user: ws.meta.user }, ws)
      return
    }

    if (!ws.meta.authed) return // ignore everything until joined with a valid token

    if (msg.type === 'cursor' && ws.meta.url) {
      broadcast(
        ws.meta.url,
        { type: 'cursor', user: ws.meta.user, x: msg.x, y: msg.y },
        ws,
      )
    }
  })

  ws.on('close', () => {
    const { url, user } = ws.meta
    const room = url ? rooms.get(url) : undefined
    if (url && room) {
      room.delete(ws)
      broadcast(url, { type: 'leave', user })
      if (room.size === 0) rooms.delete(url)
    }
  })
})

function lanIp(): string | null {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address
    }
  }
  return null
}

// Bind on 0.0.0.0 so other machines on the network can reach it.
server.listen(PORT, '0.0.0.0', () => {
  const mode = oauthConfigured()
    ? 'Linear OAuth'
    : devAllowed()
      ? 'DEV (no OAuth configured)'
      : 'LOCKED'
  const ip = lanIp()
  console.log(`\n  DQA overlay service → http://localhost:${PORT}`)
  if (ip)
    console.log(
      `  On this network     → http://${ip}:${PORT}   (use this in VITE_DQA_URL on other machines)`,
    )
  console.log(`  Demo page           → http://localhost:${PORT}/demo.html`)
  console.log(`  Auth                → ${mode}`)
  console.log(
    `  Linear push         → ${oauthConfigured() ? 'as signed-in user' : (process.env.LINEAR_DRY_RUN ?? 'true') !== 'false' ? 'DRY RUN' : 'app key'}\n`,
  )
})
