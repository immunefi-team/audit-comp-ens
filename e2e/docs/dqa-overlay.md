# DQA Overlay — design QA on the live apps

DQA lets reviewers pin comments to any element on a **running** app (including
flows needing a connected wallet or the forked chain), see each other's cursors
live, and push feedback to Linear. It beats snapshot tools because we QA the
live thing, not a screenshot.

Two pieces:

- **`packages/dqa-server`** (`@ens-apps/dqa-server`) — small Node service:
  comment persistence, image uploads, WebSocket cursor relay, "Sign in with
  Linear" (OAuth2), push-to-Linear. Serves the overlay bundle (built from
  `client/overlay.js` by Vite into `dist/`). Runs as the
  `dqa` service in `e2e/infra/docker-compose.yml` (port **4000**).
- **`packages/dev-dqa-overlay`** (`@ens-apps/dev-dqa-overlay`) — React panel +
  loader used by `@ens-apps/dev-tools` **DevDrawer**. When `VITE_DQA=1` the
  drawer loads `overlay.js` in **embed mode** (`data-embed="drawer"`): pins,
  cursors, and comment popovers stay full-screen; sign-in and toolbar controls
  live in the bottom **Dev Tools** drawer instead of a floating bottom-right
  widget.

- **`packages/dev-tools`** (`@ens-apps/dev-tools`) — unified bottom **DevDrawer**
  tab (time travel, migration tool, DQA). Mounted when any enabled tool flag is
  set — including **DQA-only on PR previews** (no `import.meta.env.DEV`
  required).

## Never in production

Gating works like `VITE_TIME_TRAVEL`, with one deliberate difference: it is
**not** limited to `import.meta.env.DEV`, because QA and PR-preview deployments
are production-mode builds. Safety comes from `VITE_DQA` being a build-time
constant: Vite inlines it, so in any build where it isn't set (all production
pipelines — `build.yml`, `deploy-portal.yml`, release builds) the guard
compiles to statically-false and the injector can never run.
**Never set `VITE_DQA` in a production deploy.**

## Local usage

```bash
pnpm e2e:infra:up          # E2E stack now includes the dqa service on :4000
```

Add to the app's `.env` and restart the dev server:

```bash
VITE_DQA=1
VITE_DQA_URL=http://localhost:4000
# optional: thread comments onto a ticket
VITE_DQA_LINEAR_ISSUE=ENG-123
```

With no Linear OAuth configured the server runs in dev mode ("Dev mode" sign-in
in the DevDrawer DQA section, dry-run Linear pushes) — instant for local use.

Open the **Dev Tools** drawer (`ENS Dev tools` trigger). Sign in / profile
controls live in the drawer header; tool tabs (Time travel, Design QA, …) sit
in the panel body. Time travel is optional — DQA works in the drawer on its own
when only `VITE_DQA=1` is set.

**Layout preference:** Use the layout icon in the Dev tools header to dock as a
bottom sheet (default) or a Figma-style right sidebar. Theme and Linear sign-in
also live in that header. The layout choice is saved in `localStorage` as
`ens-devtools:layout`.

**Comment pins:** On-page pins show the author’s Linear avatar when available
(colored letter fallback for dev login / missing photo). The comment list still
shows `#1`, `#2`, … for order.

To enable real Linear auth/pushes, copy `e2e/infra/.env.example` to
`e2e/infra/.env` (gitignored) and fill in the `LINEAR_*` / `DQA_*` values —
docker compose auto-loads that file and passes them into the `dqa` service.
(Running the server bare via `pnpm --filter @ens-apps/dqa-server dev` instead
reads `packages/dqa-server/.env`.)

## Hosted QA environment

Deploy the e2e stack (or just the `dqa` service) on a server so the whole team
shares one comment store:

```bash
docker compose -f e2e/infra/docker-compose.yml up -d dqa
```

Configure real auth via `e2e/infra/.env` on the host (template:
`e2e/infra/.env.example`; Linear OAuth walkthrough:
`packages/dqa-server/AUTH_PLAN.md`):

- `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` / `LINEAR_REDIRECT_URI`
  (`https://<dqa-host>/auth/callback`)
- `LINEAR_WORKSPACE_ID` (+ optional team/project whitelists)
- `DQA_SESSION_SECRET`, `DQA_TOKEN_ENCRYPTION_KEY`
- `DQA_DEV_AUTH=false` (default) so dev-mode sign-in is disabled

Comments and uploads persist in the `dqa-data` volume. QA app builds then use
`VITE_DQA=1` + `VITE_DQA_URL=https://<dqa-host>`.

## PR preview deployments

DQA rides the app's **existing** Cloudflare per-PR preview deployment (Workers
Builds Git integration) — no separate project, no GitHub Actions workflow. It is
enabled only for **preview (non-production) builds**.

In each app's Workers Builds project, on the **preview environment** set the
build command to `pnpm --filter <app> build:dqa` (forces `VITE_DQA=1`) — or keep
`build` and add a preview-only `VITE_DQA=1` build variable — plus
`VITE_DQA_URL=https://<dqa-host>`. The **production** environment stays on the
normal `build` with no `VITE_DQA`. Add the preview host to the dqa-server's
`DQA_ALLOWED_ORIGINS` (wildcards allowed, e.g. `https://*.workers.dev`).

Cloudflare already builds a preview per PR; this flips DQA on for those builds.
Full setup: `packages/dqa-server/MANUAL.md` §3.

## Env reference (app side)

| Var | Meaning |
| --- | --- |
| `VITE_DQA` | `1`/`true` → enable DQA in DevDrawer + load overlay. Unset in prod (build-time constant, tree-shaken). |
| `VITE_DQA_URL` | Origin of the dqa-server (default `http://localhost:4000`). |
| `VITE_DQA_LINEAR_ISSUE` | Optional `ENG-123`-style ticket that comments thread onto. |
| `VITE_DQA_MOCK_UI` | `1`/`true` → skip the DQA server; show the full Design QA inbox with sample comments and presence (for layout/UI work). |

## Design QA panel (DevDrawer)

When signed in (or in mock UI mode), the **Design QA** tab shows:

- **Toolbar** — Comment mode toggle, live presence avatars (“N viewing”), page Linear ticket link.
- **Filters** — Open / Resolved / All with counts.
- **Comment inbox** — Cards with pin number, anchored component label, excerpt, author, reply count, Linear badge, and **Focus on page** (scrolls to the element and opens the overlay thread popover).

When not signed in, use **Sign in** in the Dev tools header; the Design QA panel prompts you until you authenticate.

Mock-only mode (`VITE_DQA_MOCK_UI=1`) needs no running DQA server — useful for designing the drawer UI in isolation.

Standalone embed (legacy — floating sign-in + toolbar at bottom-right):

```html
<script type="module" src="http://localhost:4000/overlay.js?issue=ENG-123"></script>
```

`overlay.js` is an ES module, so `type="module"` is required — loaded as a
classic script it fails to parse. Configuration rides on the query string
(`?issue=`, `?embed=drawer`) because module scripts cannot read `data-*`
attributes off their own tag (`document.currentScript` is `null` in modules).

ENS apps use **DevDrawer embed mode** instead — no floating DQA chrome.
