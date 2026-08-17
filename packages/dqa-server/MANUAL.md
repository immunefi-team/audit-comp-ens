# DQA Overlay — User & Operator Manual

**DQA** (Design QA) lets designers and engineers pin comments to any element on a
**running** ENS app — including flows that need a connected wallet, the forked
chain, or signed transactions — see each other's cursors live, inspect and
live-edit component styles, and push structured feedback to Linear. Because it
runs on the live app (not a static snapshot), you QA the real thing.

It has two halves:

| Package | What it is |
| --- | --- |
| `@ens-apps/dqa-server` | The backend service (TypeScript server, run directly by Node — no transpile; the browser overlay is bundled by Vite). Stores comments, relays cursors over WebSocket, handles "Sign in with Linear", pushes to Linear, hosts `overlay.js`. |
| `@ens-apps/dev-dqa-overlay` | The build-time injector + the **Design QA** tab inside the shared **Dev tools** drawer in `apps/manager` and `apps/portal`. |

---

## 1. For reviewers (using DQA)

### Turning it on

DQA appears as a **Design QA** tab in the bottom **Dev tools** drawer whenever
the app was built/started with `VITE_DQA=1`. If you don't see it, see §2.

### Signing in

Open the **Dev tools** drawer → **Design QA** tab. Click **Sign in with
Linear** and approve. Your identity, workspace membership, and comment
authorship all come from Linear — there are no separate DQA accounts. "Use
different account" lets you switch Linear logins.

(When the server has no Linear configured — pure local dev — a "Dev mode"
button issues a throwaway local identity instead.)

### Leaving a comment

1. Click **Inspect** in the Design QA toolbar. The cursor becomes a crosshair
   and the drawer closes so you can see the whole page.
2. Hover — the element under the cursor is outlined with its component name
   (e.g. `PricingSummaryCard`). Click it.
3. A popover opens anchored to that element. Type what's wrong.
4. Optionally use the **inspector tabs**:
   - **Styles** — key computed styles, each editable. Edits preview **live on
     the page** (like Chrome DevTools) and attach to the comment as
     *suggested changes*.
   - **Classes** — the element's Tailwind classes; the class line is editable
     (also live-previews).
   - **Props** — the React props read off the component (read-only).
5. Leave **Element screenshot** checked to attach a picture of the component.
   If you made style edits, DQA captures both a **Current** and a **Suggested**
   image.
6. Click **Comment**. The pin appears; everyone viewing the page sees it live.

### Finding hard-to-reach elements

Two aids for elements that are invisible or hard to hover:

- **Highlight all** (toolbar) outlines every commentable element at once; click
  an outline to comment on it.
- **Elements** tab (the Comments / Elements / Pages toggle) is a DevTools-style
  hierarchy of the page. Hover a row to highlight that element on the page,
  click it to start a comment — even for hidden/zero-size nodes. **Refresh**
  re-reads the live DOM.

Comments are **scoped per page** — you only see pins/comments for the route
you're on (this holds across client-side SPA navigation). The **Pages** tab
lists every route that has comments with open/total counts; click one to
navigate there.

### Pins

- Click a pin (or a card in the drawer) to open its thread.
- **Drag a pin** to re-anchor it to a different element — the new position
  persists and syncs to everyone.
- Resolved pins are hidden by default; toggle **Resolved pins** in the filter
  row to show them.

### The comment inbox (drawer)

- **Open / Resolved / All** filter by status. **Everyone / Mine** filters by
  author (you).
- Click anywhere on a card to **focus** it — the page scrolls to the element and
  opens the thread.
- **Resolve** moves a comment out of the Open list (it's not deleted).
- **Delete** removes the DQA comment entirely (this does **not** touch Linear).

### Pushing to Linear

In a comment thread, choose **Send to Linear** (or a comment created with
"Send to Linear" ticked). You pick:

- **Action** — *Comment* on an existing ticket, create a *Sub-issue* under it,
  or create a standalone *Triage issue*.
- **Priority** — for created issues.
- **Target ticket** — search your Linear issues, or use the page's default
  ticket (from the `?issue=` param / `VITE_DQA_LINEAR_ISSUE`). Branches named
  `linear/<TICKET>` auto-target that ticket on PR previews.

The Linear item gets a structured body: reviewer, page, component path,
selector, viewport, the Tailwind class list, a **Suggested style changes**
table, and the Current/Suggested screenshots (uploaded to Linear's own file
storage so they always render). Sub-issues / triage issues you create are
**auto-assigned to you**.

If a pushed comment/issue is later **deleted in Linear**, DQA marks it with a
struck-through "deleted in Linear" badge; you can then Resolve or Delete it here.

### Theme

The ☀/☾ button in the Design QA toolbar toggles light/dark for the whole Dev
tools drawer and the overlay. Dark is the default; your choice is remembered.

---

## 2. For app developers (enabling DQA in a build)

The injector is already imported in `apps/manager/src/client.tsx` and
`apps/portal/src/main.tsx`. It is a **no-op unless `VITE_DQA` is set**, and the
flag is a build-time constant — production builds (where it's never set)
statically drop the code. See `e2e/docs/dqa-overlay.md`.

Local `.env` (see each app's `.env.example`):

```bash
VITE_DQA=1
VITE_DQA_URL=http://localhost:4000     # origin of the dqa-server
# optional: default Linear ticket comments thread onto
VITE_DQA_LINEAR_ISSUE=ENG-123
```

| Var | Meaning |
| --- | --- |
| `VITE_DQA` | `1`/`true` → enable DQA. Unset in prod (tree-shaken away). |
| `VITE_DQA_URL` | Origin of the dqa-server (default `http://localhost:4000`). |
| `VITE_DQA_LINEAR_ISSUE` | Optional `ENG-123`-style default ticket. |
| `VITE_DQA_MOCK_UI` | `1` → render the Design QA panel with sample data and **no** server (for designing the panel itself). |

> **Never set `VITE_DQA` in a production deploy.** It is a QA/PR-preview-only tool.

---

## 3. For operators (running the server)

### Local (with the E2E stack)

```bash
pnpm e2e:infra:up          # brings up the `dqa` service on :4000 with everything else
```

With no Linear env configured it runs in **dev mode** (local sign-in, dry-run
Linear pushes) — instant for local use.

### Running it standalone

```bash
pnpm --filter @ens-apps/dqa-server dev     # node --watch server/index.ts
```

The server is TypeScript run directly by Node's native type stripping
(**Node ≥ 22.18**, matching the Docker image) — there is no build step.
`pnpm --filter @ens-apps/dqa-server typecheck` type-checks it.

### Real Linear auth (shared / hosted)

Create a Linear OAuth app (Linear → Settings → API → OAuth applications), then
set these — via `e2e/infra/.env` for the compose service, or
`packages/dqa-server/.env` when running standalone. Full walkthrough:
`AUTH_PLAN.md`.

| Var | Purpose |
| --- | --- |
| `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` | OAuth app credentials (server-only). |
| `LINEAR_REDIRECT_URI` | `https://<dqa-host>/auth/callback` (must match the OAuth app). |
| `LINEAR_SCOPES` | `read,write` — `write` is required for screenshot uploads and issue/sub-issue creation. |
| `LINEAR_WORKSPACE_ID` | Restrict sign-in to your workspace (strongly recommended). |
| `LINEAR_ALLOWED_TEAM_IDS` / `LINEAR_ALLOWED_PROJECT_IDS` | Optional finer gating. |
| `DQA_SESSION_SECRET` | Random 32-byte hex; signs session JWTs. **Set this** or sessions reset every restart. |
| `DQA_TOKEN_ENCRYPTION_KEY` | Random 32-byte hex; encrypts the embedded Linear token. |
| `DQA_ALLOWED_ORIGINS` | Comma-separated exact origins allowed to use DQA (CORS, OAuth returns, WebSocket). **Set this in any hosted/shared deploy.** |
| `DQA_DEV_AUTH` | Leave `false` (default) so dev-mode sign-in is disabled once OAuth is on. |

Generate secrets: `openssl rand -hex 32`.

### Hosting for the team

```bash
docker compose -f e2e/infra/docker-compose.yml up -d dqa
```

Point QA/preview app builds at it with `VITE_DQA_URL=https://<dqa-host>`.
Comments and uploads persist in the `dqa-data` volume.

### PR previews

DQA rides the app's **existing** Cloudflare per-PR preview deployment (Workers
Builds Git integration) — no separate project, no GitHub Actions workflow. It's
enabled only for **preview (non-production) builds**; the production branch
never sets the flag.

In each app's Cloudflare Workers Builds project, set the **preview
environment** (non-production branches) to either:

- build command `pnpm --filter <app> build:dqa` (the script forces
  `VITE_DQA=1`), **or**
- keep the normal `build` command and add a **preview-only build variable**
  `VITE_DQA=1`.

Then add the preview build variable `VITE_DQA_URL=https://<dqa-host>` (and
optionally `VITE_DQA_LINEAR_ISSUE`). Leave the **production** environment on the
normal `build` command with no `VITE_DQA`, so production never enables DQA.

Finally, on the dqa-server add the preview host to `DQA_ALLOWED_ORIGINS`
(wildcards allowed, e.g. `https://*.workers.dev`).

That's it — Cloudflare already builds a preview per PR; this just flips DQA on
for those preview builds.

---

## 4. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| No Design QA tab | App wasn't built with `VITE_DQA=1`; restart the dev server after editing `.env`. |
| "DQA server unavailable" | The `dqa` service isn't running / `VITE_DQA_URL` is wrong. `curl $VITE_DQA_URL/auth/config`. |
| Sign-in loops / "origin not allowed" | The app's origin isn't in `DQA_ALLOWED_ORIGINS`. Add it and recreate the container. |
| Linear screenshots show "Failed to load" | Token minted before `write` scope. Set `LINEAR_SCOPES=read,write`, recreate the container, then **Sign out → Sign in** (consent screen must show write access). |
| Screenshots never attach | Old capture engine on Tailwind v4 `oklch()` colors — fixed; hard-refresh so the new `overlay.js` loads. |
| Config change ignored | `public/` assets are live-mounted (hard-refresh). `client/overlay.js` is bundled, so overlay **and** server code changes need `docker compose ... up -d --build dqa`. |

See **`SECURITY.md`** for the security model and audit.
