# Per-PR e2e infra on Railway

Ephemeral copy of the local e2e stack (see `../docker-compose.yml` +
`../docker-compose.snapshot.yml`) for every pull request, so reviewers can use
DQA, time travel, grace period, and temp premium flows against a PR preview —
same environment as local dev.

Lifecycle is driven by `.github/workflows/railway-pr-infra.yml`:
PR opened → duplicate the base environment as `pr-<number>` → post service URLs
as a PR comment. PR closed/merged → delete the environment.

## Why snapshot anvil (not a live fork)

Each PR environment would otherwise run its own Sepolia fork: every uncached
state read hits the upstream RPC (rate limits) and anvil's memory grows with
fork-state caching. `ghcr.io/ensdomains/ens-v2-snapshot` loads pre-seeded state
(`--load-state`) with ENS V2 contracts deployed and test accounts funded — no
upstream RPC, deterministic state, boots in seconds, small fixed footprint.
Anvil cheatcodes (`evm_increaseTime` etc.) work, so the time-travel dev tool
functions exactly as it does locally.

If a PR needs newer contract deployments than the snapshot contains, rebuild
the snapshot image first (`build-ens-v2-snapshot` workflow).

## One-time Railway setup

1. Create a Railway project (suggested name: `ens-pr-infra`) with a **base
   environment** (e.g. `pr-base`). This environment is the template every PR
   duplicates; it can stay scaled down / sleeping.
2. Add GHCR registry credentials in project settings (the snapshot and
   mockestrator images are private): a GitHub PAT with `read:packages`.
3. Create the six services in the base environment:

   | Service (name matters — the workflow references them) | Source | Public port |
   |---|---|---|
   | `anvil` | Image `ghcr.io/ensdomains/ens-v2-snapshot:latest` | 8545 |
   | `alto` | Repo, root dir `e2e/infra`, Dockerfile `railway/alto/Dockerfile` | 4337 |
   | `paymaster` | Image `ghcr.io/pimlicolabs/mock-verifying-paymaster:main` | 3000 |
   | `panoptes` | Repo, root dir `e2e/infra`, Dockerfile `railway/panoptes/Dockerfile` | 5655 |
   | `mockestrator` | Repo, root dir `e2e/infra`, Dockerfile `railway/mockestrator/Dockerfile` | 3000 |
   | `dqa` | Repo, root dir `packages/dqa-server` (its own Dockerfile) | 4000 |

   Notes:
   - `anvil` custom start command:
     `anvil --load-state /state.json --chain-id 11155111 --port 8545 --host 0.0.0.0 --host ::`
     (the extra `--host ::` covers IPv6 private networking).
   - `panoptes` runs indexer + API in one container on purpose: Railway
     volumes can't be shared between services, and the two processes share a
     sqlite file. See `railway/panoptes/entrypoint.sh`.
   - Set each service's **target port** for its public domain as listed above
     (services talk to each other over the private network:
     `<service>.railway.internal:<port>`).
4. Base-environment variables for `dqa` (copied into every PR env — names per
   `packages/dqa-server/.env.example`):

   ```bash
   SESSION_SECRET=<random string>               # signs DQA session JWTs
   TOKEN_ENCRYPTION_KEY=<random string>         # encrypts embedded Linear tokens
   # SECURITY: scope wildcards to YOUR account subdomain — never bare
   # *.workers.dev / *.pages.dev / *.up.railway.app. This list gates CORS *and*
   # the OAuth return origin, so a bare *.workers.dev would let ANY Cloudflare
   # worker (an attacker's included) receive a freshly-minted session token.
   # Previews run under the ENS account subdomain (only ENS can publish there):
   #   https://<branch>-manager-app-v4.ens-cf.workers.dev
   #   https://<branch>-portal-app.ens-cf.workers.dev
   # so scope to that subdomain:
   DQA_ALLOWED_ORIGINS=https://*.ens-cf.workers.dev,http://localhost:3000,http://localhost:3001
   ```

   **Linear OAuth — delegated auth**: Linear requires exact registered
   redirect URIs, and per-PR dqa domains aren't known in advance. The base
   environment's dqa (long-lived, fixed domain) acts as the auth instance:
   register `https://<base-dqa-domain>/auth/callback` in the one Linear OAuth
   app and set on the base dqa service:

   ```bash
   LINEAR_CLIENT_ID=...
   LINEAR_CLIENT_SECRET=...
   LINEAR_REDIRECT_URI=https://<base-dqa-domain>/auth/callback
   DQA_AUTH_URL=https://<base-dqa-domain>
   ```

   All variables copy into PR envs unchanged, and everything just works:
   the PR dqa's overlay opens the sign-in popup against the base instance
   (per `DQA_AUTH_URL`), the OAuth callback lands on the base instance (its
   `redirect_uri`), and the session JWT it mints is valid on the PR instance
   because `SESSION_SECRET`/`TOKEN_ENCRYPTION_KEY` are shared. Reviewers get
   real per-user Linear pushes on every PR with a single OAuth app.
   **`SESSION_SECRET` must be set explicitly** — if blank, each instance
   auto-generates its own and delegated sessions fail with 401s.

   Comment isolation across PRs needs no configuration: comments are keyed by
   `location.origin + pathname`, so different preview domains never mix, and
   each PR env has its own dqa instance and store anyway. The store lives on
   the container filesystem — comments survive for the PR's lifetime but not a
   dqa redeploy; attach a Railway volume at `/app/data` to the base env's dqa
   service if that matters.
5. Repo configuration (GitHub → Settings):
   - Secret `RAILWAY_API_TOKEN`: **account-scoped** API token (not a project
     token — those can't create/delete environments). Use a bot/CI account
     **without 2FA**: environment deletion hangs non-interactively with 2FA
     ([railwayapp/cli#776](https://github.com/railwayapp/cli/issues/776)).
   - Variable `RAILWAY_PROJECT_ID`, variable `RAILWAY_BASE_ENV_ID` (both shown
     in the Railway dashboard URL / settings).

## Per-PR flow

1. PR opened → workflow creates `pr-<n>` by copying the base env. The `dqa`
   service is **NOT** built from the PR branch — it runs the base (trusted)
   code. Building PR-authored code with `LINEAR_CLIENT_SECRET` /
   `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` present would let a malicious PR
   exfiltrate them at runtime. Previews therefore use the shared base dqa for
   auth + data (`VITE_DQA_URL` → base dqa domain); `dqa-server` code changes
   are validated via local `pnpm --filter @ens-apps/dqa-server dev` / e2e, not
   PR previews.
2. Public domains are generated per service and posted as a PR comment,
   including a snippet for pointing a local app build at the environment.
3. PR closed or merged → environment deleted, all services deprovisioned.

## Using an environment

Until the Cloudflare preview builds are configured (separate task — requires
Cloudflare access) with `VITE_DQA=1`, `VITE_DQA_URL`, and the infra URLs, test
full circle by pointing a local build at the PR env — values are in the PR
comment:

```bash
VITE_SEPOLIA_RPC_URL=https://anvil-pr-123.up.railway.app
VITE_INDEXER_GRAPHQL_URL=https://panoptes-pr-123.up.railway.app/graphql
VITE_DQA=1
# Shared base dqa (fixed domain) — NOT a per-PR dqa; see Per-PR flow step 1.
VITE_DQA_URL=https://<base-dqa-domain>
```

Known gaps / follow-ups:

- **Alto CORS**: locally the app reaches alto through a Vite proxy
  (`/alto`) to avoid CORS. A browser hitting the Railway alto domain directly
  may be blocked — for local builds keep using the Vite proxy (point its
  target at the Railway alto URL); for Cloudflare previews this needs a proxy
  route or CORS headers in front of alto.
- **Fork PRs**: `pull_request` from forks doesn't get secrets, so infra is
  only created for same-repo branches.
- **Cost**: 6 services per open PR. If that's too much, gate on the
  `railway-infra` label (commented out in the workflow) so only opted-in PRs
  get an environment.
- The `railway domain` output parsing in the workflow is best-effort — verify
  the URL table on the first real PR and adjust the grep if the CLI output
  format changed.
