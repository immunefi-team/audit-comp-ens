# Manual time travel (grace period / temporary premium)

A persistent local environment for **manually** exercising time-based name
states — active → expiring → grace period → temporary premium → released — and
advancing time yourself, as many times as you like. It reuses the same Anvil
stack and `createMakeName` flow as the Playwright suite, but without a test run
that tears everything down.

## Why this needs a browser clock (the key idea)

The apps compute "now" from the browser's `Date.now()` (e.g.
`useGraceStatus`, `premiumDecay`, `useTickingNowMs`), while a name's expiry and
premium come from the **chain**. The Playwright suite keeps the two in lockstep
via `page.clock` (see `e2e/fixtures/time.ts`):

1. **Chain time** — `testClient.increaseTime()` + `mine()` on Anvil.
2. **Browser time** — `page.clock.setSystemTime()`.

A real browser has no `page.clock`. So if you only warp Anvil, the UI's clock
stays at real wall-clock time and grace/premium/expiry UIs never reflect the
warp. The dev-only **Time Travel panel** is the manual-browser equivalent: it
advances both at once and installs a `Date` shim that tracks the (warp-able)
Anvil block time.

This is gated behind `VITE_TIME_TRAVEL` and `import.meta.env.DEV`, so it never
ships to production.

## 1. Start the stack

```bash
pnpm --filter @ens-apps/e2e infra:up      # Anvil + bundler + paymaster + indexer + mockestrator
```

Chain state persists for the life of the containers, so seeded names and time
warps survive browser reloads. Stop it later with `infra:down`.

## 2. Run an app with time travel enabled

Both apps' dev servers already proxy `/rpc` → the Anvil fork, which the panel
uses. Enable the flag (uncomment it in the app's `.env`, or pass inline):

```bash
# Portal (http://localhost:3001)
VITE_TIME_TRAVEL=1 pnpm --filter @ens-portal dev   # or: cd apps/portal && VITE_TIME_TRAVEL=1 pnpm dev

# Manager (http://localhost:3000)
VITE_TIME_TRAVEL=1 pnpm --filter @ens-manager dev  # or: cd apps/manager && VITE_TIME_TRAVEL=1 pnpm dev
```

> The exact dev script/package name may differ — see each app's `package.json`.
> Override the RPC endpoint with `VITE_TIME_TRAVEL_RPC` if you don't use `/rpc`.

A small **⏱ Time Travel (dev)** panel appears bottom-left.

## 3. Seed names in a given state (optional)

```bash
STATE=grace    pnpm --filter @ens-apps/e2e seed:name
STATE=premium  pnpm --filter @ens-apps/e2e seed:name
STATE=released pnpm --filter @ens-apps/e2e seed:name
STATE=active   pnpm --filter @ens-apps/e2e seed:name

# Explicit control:
EXPIRED_AGO_DAYS=5 pnpm --filter @ens-apps/e2e seed:name   # 5 days past expiry
EXPIRES_IN_DAYS=120 pnpm --filter @ens-apps/e2e seed:name  # active, expires in 120d
OWNER=user STATE=grace pnpm --filter @ens-apps/e2e seed:name

# Premium shortcut (unchanged):
LABEL=tem DAYS=13.3 pnpm --filter @ens-apps/e2e seed:premium
```

The script prints the full name plus the buyer (`/register/<name>`) and profile
(`/<name>`) URLs. `premium`/`released` register to `user2` (so your connected
`user` wallet isn't the exempt previous owner); `active`/`expiring`/`grace`
register to `user` (so you see grace banners on your own profile/dashboard).

## 4. Travel in time

Open a seeded name (or any name), then use the panel:

- **+1h / +1d / +7d / +30d / +90d / +1y** or **Advance days** — warps Anvil
  (`evm_increaseTime` + `evm_mine`) and the browser clock together, then reloads
  so cached on-chain reads (e.g. premium price from `getRegisterPrice`) refetch.
- **Sync to chain** — set the browser clock to the current Anvil block time
  (use this after seeding, or any time the two drift apart).
- **Real time** — clear the offset; the browser returns to real wall-clock time.

The most flexible workflow: **seed an `active` name, then advance time** and
watch it move through expiring → grace → premium → released, live, repeatedly.

## Caveats

- **Seeding past-expiry states advances the shared clock.** A `grace`/`premium`/
  `released` seed registers the name then warps Anvil past its expiry, so the
  single shared chain clock jumps forward. Seeding several past-expiry names in
  a row keeps pushing the clock and can move earlier names further along their
  lifecycle. Prefer seeding `active` names and using the panel for a clean walk.
- **`expiring` = 28 days.** The registrar enforces a 28-day minimum
  registration, so the soonest positive-duration expiry is 28d. For a name
  "expiring in 3 days", seed `active` and advance with the panel.
- **The offset persists** in `localStorage` (`ens:time-travel:offsetMs`) and is
  re-derived from the live block on load, so reloads stay aligned.
- **Manager is SSR** — the first paint may briefly show server (real) time
  before the client clock applies; the reload-after-warp resolves it.

## Future: time travel on PR previews (not implemented)

Time travel could ride the Cloudflare PR previews exactly like the DQA overlay
(see `packages/dqa-server/MANUAL.md`). It shares the same DevDrawer, so the
**app-side change is trivial** — one line:

- In `packages/dev-time-travel/src/config.ts`, drop the `import.meta.env.DEV &&`
  from `isTimeTravelEnabled()` so it's flag-only (mirrors `isDQAEnabled()`), then
  enable `VITE_TIME_TRAVEL=1` + `VITE_TIME_TRAVEL_RPC=<url>` on the app's
  **preview** Cloudflare build only (never production). A `build:tt` script like
  `build:dqa` would make this explicit.

**The real blocker is infra, not code.** The panel advances chain time via
`evm_increaseTime` + `evm_mine`, which only exist on an **Anvil / fork node** —
real Sepolia rejects them. So previews would need `VITE_TIME_TRAVEL_RPC` pointed
at a persistent, public, HTTPS-reachable forked-chain node. That fork could live
on the **same QA host as the DQA server** (e.g. `https://qa.app.ens.dev/rpc`
alongside `…/overlay.js`), but standing up a stateful shared fork — chain state,
reset policy, who can warp it — is the non-trivial part and is why this is
deferred. Until such an endpoint exists, time travel stays dev-only (local
`infra:up` stack), while DQA works on previews because it only needs a plain
HTTP service.
