# DQA Overlay — v0

A minimal Design-QA tool. Designers open a **live** page, click any element, and leave
a comment pinned to that element. They see each other's cursors in real time, attach
screenshots, and push any comment straight to Linear as an issue.

It injects with a single `<script>` tag, so it works on a real running app — including
flows that need a connected wallet, a testnet env, or signed transactions. That's the
reason this beats a snapshot tool like Chromatic for our case: **we QA the live thing,
not a static image of it.**

```
┌──────────────────────┐        ws + REST         ┌─────────────────────┐
│  Any page +          │  ───────────────────────▶ │  Small service      │
│  <script overlay.js> │                            │  • comments (JSON)  │
│  • pin-on-click      │  ◀─────────────────────── │  • image upload     │
│  • live cursors      │     comment broadcast      │  • live cursor relay │
│  • push to Linear    │                            │  • Linear issueCreate│
└──────────────────────┘                            └─────────────────────┘
```

## Run it (for the demo)

```bash
cd dqa-overlay
pnpm install
pnpm dev
```

Then open **http://localhost:4000/demo.html**. With no Linear OAuth configured, the
sign-in card offers **Continue in dev mode** — pick a name and you're in. Click
**Comment** in the bottom-right toolbar, then click any element on the page.

Open the same URL in a second window (different name) to see **live cursors and presence**
between two reviewers.

No native dependencies, so `pnpm install` works on any teammate's machine.

## Auth — "Sign in with Linear"

Identity and access control come from Linear via OAuth2 (not pasted API keys). A reviewer
signs in with Linear; the service checks they belong to your workspace (and optionally a
specific team/project) before letting them comment. The REST API and the WebSocket are
both gated — no valid session, no comments and no cursor.

- **Dev mode** (nothing configured): a "Continue in dev mode" button issues a local
  session so the demo runs instantly. Disable in real deployments.
- **Real mode**: set the OAuth env vars and the dev button disappears.

Sessions are stateless signed JWTs (no DB). When `LINEAR_ACTOR=user`, the reviewer's
Linear token is **AES-encrypted and embedded inside the JWT**, so the server can post
comments as them without a token database — the browser only ever holds ciphertext.

**Full setup walkthrough — what to create in Linear, which scopes, how to find the IDs —
is in [AUTH_PLAN.md](./AUTH_PLAN.md).** Env keys are in `.env.example`.

### Comments → a specific ticket

The injected snippet carries the feature's ticket:

```html
<script type="module" src="https://dqa-host/overlay.js?issue=ENG-123"></script>
```

Every comment on that page threads onto `ENG-123` as a Linear comment, authored by the
reviewer. Your `linear/<ticket-id>` branch convention means preview builds already know
their ticket, so this can be filled in automatically. No `?issue=` → falls back
to creating a new issue (needs the `issues:create` scope + `LINEAR_TEAM_ID`).

## How it maps to what we discussed

| Idea | How it's done here |
|---|---|
| Like Vercel Toolbar comments | Floating toolbar, click-to-pin, threaded replies, resolve |
| Works on live blockchain envs | It's a script on the real page, not a snapshot — wallet/testnet flows just work |
| Comments straight into Linear | "Push to Linear" → `issueCreate` mutation, with element selector + screenshot in the body |
| Upload images | File input on each comment, stored by the service |
| See cursors live | WebSocket presence + cursor relay, one "room" per page URL |
| Hover the PR deployment | Inject the same `<script>` into preview builds only (see below) |
| Use on whatever site | The script is origin-agnostic; graduate to a Chrome extension when you need sites you don't control |

## Wiring into PR previews (the v0 rollout path)

Don't build the Chrome extension yet. Inject the script **only in preview/non-prod
builds** so every PR deployment gets the overlay for free:

```html
<!-- in your app shell, gated on the deploy env -->
<script>
  if (import.meta.env.MODE !== 'production') {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://<your-dqa-host>/overlay.js';
    document.head.appendChild(s);
  }
</script>
```

Point `overlay.js` at wherever you host the service (locally exposed via a tunnel is fine
for v0). The extension only matters later, when you want to comment on sites whose deploy
you don't control — same overlay code, repackaged.

## Linear setup

The service runs in **dry-run by default** (it logs what it *would* create — safe for the
demo). To create real issues:

```bash
cp .env.example .env
# fill in:
#   LINEAR_API_KEY   (Settings → Security & access → API → Personal API keys)
#   LINEAR_TEAM_ID
#   LINEAR_DRY_RUN=false
```

Each issue gets a `[DQA]` title, the comment body, the reviewer, the page URL, the
**element selector**, and the screenshot if attached.

## The part that makes pins survive code changes

A pixel coordinate breaks the moment layout shifts between PRs. Each comment instead
stores a resilient anchor, tried in order:

1. a stable attribute on the element or an ancestor — `data-testid`, `data-component`,
   `data-qa`, `id`
2. a CSS path with `:nth-of-type` as fallback
3. the click's offset *inside* the element (so the pin lands on the right spot), plus
   page-percentage coords as a last resort

**Action for us:** add `data-component` / `data-testid` to design-system components. We
own the codebase, so this is cheap and it's what makes anchoring reliable. The demo page
shows it — pins land on `PlanCard`, `SearchBar`, etc. regardless of layout.

## What's intentionally NOT in v0

- **Auth / allowlist** — next step is a magic-link login so the token gates who can
  comment and connect a cursor. Architecture is ready (every write + WS join can carry a
  token); it's just not enforced yet.
- **Real database** — JSON-file store for now. Swap `server/db.js` for Postgres/SQLite
  when it graduates.
- **Chrome extension** — deferred on purpose. The injected-script path covers our PR
  previews with zero install friction. Build the extension only when we need arbitrary
  sites.

## Files

```
dqa-overlay/
├─ server/
│  ├─ index.js     REST + WebSocket + static serving
│  ├─ db.js        JSON-file store (swap later)
│  └─ linear.js    Linear issueCreate (dry-run gated)
├─ client/
│  └─ overlay.js   the injectable widget (shadow DOM, pins, cursors, Linear)
│                 built by Vite into dist/ — see vite.config.ts
├─ public/
│  └─ demo.html    sample app to demo on
└─ .env.example
```
