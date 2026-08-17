# Railway PR-infra — Security Audit

Scope: the per-PR e2e infrastructure on Railway and the DQA service it hosts —
`.github/workflows/railway-pr-infra.yml`, `e2e/infra/railway/**`, and the
`packages/dqa-server` code that runs in it. Threat model: same-repo PRs from
contributors, plus anyone who discovers a preview/service URL. Fork PRs get no
secrets (GitHub default), so they're out of scope.

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | `github.head_ref` interpolated into a `run:` block while `RAILWAY_API_TOKEN` was in env → a crafted branch name could execute shell and exfiltrate the account-scoped token | **Fixed** |
| 2 | High | Per-PR `dqa` built from PR branch with shared Linear/session secrets present → arbitrary PR code could exfiltrate them at runtime | **Fixed** |
| 3 | High | `DQA_ALLOWED_ORIGINS` example used bare `*.pages.dev` / `*.up.railway.app`; this gates the OAuth return origin, so any Pages/Railway site could receive a session token | **Fixed (docs); action: narrow the live env var** |
| 4 | Medium | `--copy` replicated the `dqa` service + its secrets into every PR env | **Fixed** (per-PR copy deleted post-create) |
| 5 | Medium | `panoptes` entrypoint used non-POSIX `wait -n` (no-ops in dash → dead indexer stays "healthy") and a `sleep 5` that raced DB creation | **Fixed** |
| 6 | Medium | Linear `fetch` calls had no timeout → an upstream outage hangs `/api/comments`, pushes, auth callback | **Fixed** |
| 7 | Low | WS `join` didn't leave the previous room on SPA nav → stale cursor delivery | **Fixed** |
| 8 | Low | anvil exposes cheatcodes unauthenticated; in fork mode also proxies a keyed upstream RPC | **Documented / mitigated** |
| 9 | Info | Private keys committed in `alto-config.railway.json` | **Not a vulnerability** (public test keys) |
| 10 | Info | `RAILWAY_API_TOKEN` is account-scoped (broad blast radius) | **Inherent; mitigated by dedicated CI account** |

## Details & resolutions

**1. Workflow shell injection.** Removed the `--service-config dqa source.branch
"${{ github.head_ref }}"` pin, so no Git ref reaches a shell. The remaining
dynamic value in the PR-comment step is passed via `env:`, not interpolated into
the script body.

**2. PR-controlled code with secrets.** The per-PR env no longer builds `dqa`
from the PR branch and no longer exposes a per-PR dqa domain. Previews use the
shared **base** dqa (trusted code, fixed domain). `dqa-server` changes are
validated locally / via e2e. Note: delegated auth does **not** remove this on
its own — the PR server still needs the shared secrets to validate/decrypt
sessions — which is why we stopped running PR code there entirely.

Applies to **`TOKEN_ENCRYPTION_KEY` too** (per @mdtanrikulu): it decrypts the
reviewers' embedded personal Linear tokens (`session.lt`), so leaking it means
impersonating users against Linear — not just forging DQA sessions. The same
fix covers it, since the same fix removes all PR-controlled code from the
secret-bearing service.

**3. Over-broad origin allowlist.** `DQA_ALLOWED_ORIGINS` gates CORS *and* the
OAuth return origin. `https://*.pages.dev` would let any Cloudflare Pages site
(incl. an attacker's) initiate sign-in and receive a freshly-minted session
token. README now shows project-scoped wildcards
(`https://*.<project>.pages.dev`). **Action:** narrow the value on the live base
dqa service to match.

**4. Secret replication.** A post-create step deletes the copied `dqa` service
from each PR env so `LINEAR_CLIENT_SECRET` / `SESSION_SECRET` /
`TOKEN_ENCRYPTION_KEY` aren't duplicated across N environments (best-effort;
warns if the CLI syntax differs).

**5. panoptes entrypoint.** Rewritten in POSIX `sh`: polls for the DB file
(bailing if the indexer dies, warning after 60s) instead of `sleep 5`, and
supervises both children with a `kill -0` loop so a dead indexer exits the
container rather than reporting healthy forever.

**6. fetch timeouts.** Per @mdtanrikulu, applied to **all** outbound calls, not
just the flagged one — every Linear `fetch` site now uses `AbortSignal.timeout`:
`auth.ts` (token exchange, GraphQL viewer/whitelist, revoke) and `linear.ts`
(GraphQL push/search/status, image upload). 10s default; 30s for the upload PUT.

**7. WS room reassignment.** On re-join, the socket leaves its previous room
(with a `leave` broadcast) before joining the new one.

**8. anvil exposure.** Accurate only in **fork** mode. The documented/default
base setup uses the **snapshot** image (`--load-state`, no upstream RPC), which
removes the key-proxy/quota-abuse vector; only open cheatcodes remain, on
throwaway testnet state in a short-lived env (deleted on PR close + nightly
sweep). The fork `Dockerfile` (fallback) now documents: prefer snapshot; if
forking, use a dedicated rate-limited key, never the shared/production RPC key.

**9. Committed keys.** The `utility-private-key` / `executor-private-keys` in
`alto-config.railway.json` are well-known public Anvil/Pimlico test keys, funded
only on the ephemeral chain — not production secrets. Called out to preempt
secret scanners.

**10. Account-scoped token.** `RAILWAY_API_TOKEN` must be account-scoped —
project tokens can't create/delete environments. Mitigated by running it on a
dedicated CI/bot account with minimal Railway access.

## Pending actions (owner: infra)

- [ ] **Narrow the live `DQA_ALLOWED_ORIGINS`** on the base dqa service in
  Railway (finding #3). Current value still contains the over-broad
  `https://*.pages.dev` and `https://*.up.railway.app`.

  PR previews are Cloudflare **Workers** under the ENS account subdomain
  `ens-cf.workers.dev` (only ENS can publish there), e.g.:
  - `https://ft-web-647-manager-app-v4.ens-cf.workers.dev`
  - `https://ft-web-647-portal-app.ens-cf.workers.dev`

  Recommended value (confirm the account subdomain is `ens-cf` on the first
  real preview, then set):
  ```
  https://*.ens-cf.workers.dev,http://localhost:3000,http://localhost:3001
  ```
  Notes: `*.ens-cf.workers.dev` is safe because that subdomain is unique to the
  ENS Cloudflare account; drop `*.up.railway.app` (the overlay never runs on a
  Railway domain — add the exact base-dqa host only if you use its `/demo.html`).

- [ ] **Confirm `railway service delete dqa --yes`** matches the installed
  Railway CLI version (finding #4). The workflow step warns instead of failing
  if the syntax differs.

## Residual risk (accepted)

- Public **alto / paymaster / mockestrator** on the throwaway chain: anyone with
  the URL can submit UserOps / query the indexer. Testnet-only, ephemeral;
  acceptable. GraphQL depth/cost limits are set on panoptes.
- anvil cheatcodes remain callable by anyone with the URL (see #8) — bounded to
  a disposable per-PR chain.
