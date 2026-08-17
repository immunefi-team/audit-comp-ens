# DQA Overlay — Security Model & Audit

This document is for reviewers evaluating whether DQA is safe to run and host.
It states the threat model, walks through each sensitive area, and records the
audit findings and their resolutions.

**TL;DR for the "are we exposing keys?" question:** No secrets ever reach the
browser. The Linear **client secret** lives only in the server's environment
and is used only in the server-to-server token exchange. The client bundle
(`overlay.js`, the injector) contains **no credentials** — it only knows the
server's origin. The reviewer's Linear access token is AES-256-GCM encrypted
and embedded inside a signed session token; the browser only ever holds
ciphertext it cannot decrypt.

---

## 1. Threat model & scope

DQA is a **QA / PR-preview-only** internal tool. It is never shipped to
production app builds (the `VITE_DQA` flag is a build-time constant that
tree-shakes the injector out of prod bundles — verified against the real Vite
build). The server is intended to run locally, on an internal QA host, or
behind the team's normal access controls.

Assets worth protecting:

- The Linear **client secret** and reviewers' Linear **access tokens**.
- The **session-signing secret** and **token-encryption key**.
- The comment store and uploaded screenshots (may show pre-release UI).

Primary threats considered: token exfiltration via crafted OAuth redirects,
cross-origin abuse (CSRF/CORS/WebSocket), stored-file XSS, secret leakage into
the client, and unauthenticated access to the API.

---

## 2. Where secrets live

| Secret | Location | Reaches browser? |
| --- | --- | --- |
| `LINEAR_CLIENT_SECRET` | Server env only; used in `POST /oauth/token` | **No** |
| Reviewer Linear access token | AES-256-GCM encrypted, embedded in the session JWT (`lt` claim) | **Only as ciphertext** |
| `DQA_SESSION_SECRET` | Server env only (HMAC key for session JWTs) | No |
| `DQA_TOKEN_ENCRYPTION_KEY` | Server env only (derives the AES key) | No |

- Secrets are provided via environment (`e2e/infra/.env` or
  `packages/dqa-server/.env`), both **gitignored**. `.env.example` files carry
  only placeholders.
- The client (`overlay.js`) derives the API origin from its own module URL (`import.meta.url`)
  and holds only the opaque session token in `localStorage`. It has no client
  id, no secret, no Linear token in cleartext.

## 3. Authentication & authorization

- Identity comes from **Linear OAuth2** (`actor=user`). There are no DQA
  passwords.
- The DQA session is a hand-rolled **HS256 JWT**, verified with a
  constant-time HMAC comparison (`crypto.timingSafeEqual`); expired tokens are
  rejected. Signature is always recomputed as HMAC-SHA256 regardless of the
  token header, so `alg:none`/algorithm-confusion cannot bypass it.
- Every REST route except `/auth/config`, `/auth/*` entry points, and static
  assets is behind `requireAuth`. The WebSocket ignores all messages until a
  `join` carrying a valid token.
- Comment **authorship and identity are taken from the verified session**,
  never from client-supplied fields.
- Optional workspace/team/project **allowlists** (`LINEAR_WORKSPACE_ID`, …)
  gate who may sign in.
- **Dev mode** (passwordless local identity) is only available when OAuth is
  unconfigured or `DQA_DEV_AUTH=true`; it is off by default on a configured
  server.

## 4. Audit findings & resolutions

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | **High** | OAuth `returnUrl`/`origin` were caller-supplied and used as the `postMessage` target and redirect after sign-in. A crafted `/auth/linear?returnUrl=https://evil.com` could exfiltrate a freshly-minted session token. | Added an **origin allowlist** (`DQA_ALLOWED_ORIGINS`, defaulting to loopback/private ranges in local dev). `origin`/`returnUrl` are validated at both authorize time and callback redemption; `postMessage` uses a concrete allowlisted origin and **never** `"*"`. |
| 2 | Medium | CORS reflected any `Origin`. | CORS now reflects the origin **only if allowlisted**, with `Vary: Origin`. Auth is Bearer-token (never cookies), so no credentialed cross-site requests are possible regardless. |
| 3 | Medium | WebSocket accepted any cross-origin handshake. | `verifyClient` rejects non-allowlisted origins (defence in depth; messages are still token-gated). |
| 4 | Medium | Uploads used the client-supplied filename/extension; a non-image (e.g. `.html`) could be stored and served from the DQA origin (stored-XSS/phishing surface). | Uploads are restricted to image MIME types via `fileFilter`; the server **forces** a safe extension and a random UUID filename (never derived from client input); single-file, 8 MB cap. |
| 5 | Medium | Screenshots served as static files. | Served with `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, and a locked-down `Content-Security-Policy: default-src 'none'; sandbox`, so a stored file can't execute as script/HTML. Filenames are unguessable UUIDs. |
| 6 | Low | Client-supplied `inspect`/`styleEdits` payloads persisted to Linear/comment store. | Sanitized and length-capped server-side (`sanitizeInspect`, `sanitizeStyleEdits`); all rendering escapes HTML. |
| 7 | Info | Linear-stored screenshots return "Failed to load" outside Linear. | Expected: `uploads.linear.app` files are private and require the viewer's Linear auth — they render inside Linear for authorized members, which is the intended audience. |

## 5. Residual risks & recommendations

- **No built-in rate limiting.** Acceptable for an internal tool; put it behind
  the team's normal ingress/auth if exposed more broadly.
- **`/uploads` is unauthenticated** (so overlay `<img>` tags can load without a
  bearer header). Filenames are unguessable UUIDs and screenshots are QA-only;
  if the host is internet-facing, front it with network-level access control.
- **Always set `DQA_ALLOWED_ORIGINS`, `DQA_SESSION_SECRET`, and
  `DQA_TOKEN_ENCRYPTION_KEY`** on any shared/hosted deploy. Keep
  `DQA_DEV_AUTH=false`.
- **Rotate `LINEAR_CLIENT_SECRET`** if it is ever shared or committed, and use
  distinct session/encryption secrets per environment.
- Session tokens live 12h; Linear access tokens are valid 24h. If session
  lifetime is ever raised past 24h, implement the OAuth refresh-token flow.

## 6. Production-exposure guarantee

`VITE_DQA` is inlined by Vite at build time. Production builds never set it
(it lives only in gitignored `.env.local` for local dev, or in the dedicated
Cloudflare **DQA preview** projects' build variables — see below), so
`isDQAEnabled()` compiles to a constant `return false`. Consequences in a
production bundle, confirmed by building with the repo's Vite and inspecting
output:

- The DevDrawer **never renders** and the overlay script is **never loaded** —
  the guard is a compile-time constant `false`, not a runtime config value.
- No secrets, URLs, or DQA server calls are reachable at runtime.
- A small amount of DQA/DevDrawer code remains present-but-unreachable in the
  bundle (the minifier folds the guard to `false` but does not always drop the
  dead block). This is bundle weight only — never executed. If full dead-code
  elimination is desired, gate the DevDrawer mount site on the inlined
  expression directly (e.g. `import.meta.env.VITE_DQA === '1' || …`) so the
  branch is statically dropped.

DQA is enabled only on the apps' **preview (non-production)** Cloudflare builds,
via a preview-scoped build command (`build:dqa`, which forces `VITE_DQA=1`) or a
preview-only build variable. The **production** environment uses the normal
`build` with no `VITE_DQA`, so it cannot enable DQA. The flag is never present
in a committed `.env`.

## 7. Re-audit — 2026-07-21 (feature wave: redesign, reply threading, markdown export)

Scope: changes since the last audit — thread/compose/picker redesign, reply →
Linear threaded push, Markdown export, screenshot lightbox, pins toggle, ENS
theming.

**Verified clean (static review + live smoke test):**
- All new `innerHTML` builders (`pathRowHtml`, `metaStripHtml`, `shotBoxHtml`,
  thread/compose/picker markup) escape every dynamic value with `esc()`;
  remaining interpolations are static markup, numeric counts, or fetch URLs
  with server-generated UUIDs.
- `pushReplyToLinear` uses the replier's own encrypted token (actor=user),
  never a shared credential; dev sessions skip the push (`linearSynced: false`
  confirmed live). Errors are caught — the DQA reply persists regardless.
  `decrypt()` returns `null` on any failure (no throw in the async handler).
- Lightbox: image `src` comes only from same-origin `/uploads/` paths; caption
  set via `textContent`; Escape listener removed on close.
- Auth still enforced on every mutating endpoint (401 without token verified);
  upload path traversal returns 404; blank replies rejected (400).
- `.env.local` gitignored in both apps; no `VITE_DQA` in tracked env files.

**Fixed in this pass (previously missing input caps):**
- `POST /api/comments`: `body` capped at 5,000 chars, `url` at 2,000,
  `issueRef` at 40; `anchor` now sanitized (selector ≤500, label ≤200,
  numeric offsets validated, unknown keys dropped) instead of stored raw;
  `imageUrl` now restricted to our own `/uploads/` paths (the "after" image
  already was — external URLs are rejected).
- `POST /api/comments/:id/reply`: body trimmed, required, capped at 5,000.

All verified against a live server instance (sanitizer clamps confirmed via
oversized/malicious payloads).
