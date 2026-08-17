# DQA Auth — Linear setup

Use Linear as both **identity** (who you are) and **authorization** (whether you're
allowed in) via **"Sign in with Linear" (OAuth2)**. No pasted API keys for end users.
Comments thread onto the feature's existing Linear ticket, authored by the real person.

This is the one-time manual setup you do in Linear. The implementation it was
originally written against has shipped — see `MANUAL.md` for running the
service and `SECURITY.md` for the threat model.

---

## What to create in Linear

### 1.1 Create the OAuth application

1. Linear → **Settings → API → OAuth applications → Create new**.
2. Fill in:
   - **Application name:** `ENS DQA`
   - **Developer / icon:** whatever you like.
   - **Callback URLs (redirect URIs):** add every host the service will run on, e.g.
     - `http://localhost:4000/auth/callback` (local dev)
     - `https://<your-tunnel-or-host>/auth/callback` (when exposed via tunnel/deploy)
     - Redirect URIs must match **exactly** at login time — add each one you'll use.
3. After saving you get a **Client ID** and **Client Secret**. Copy both. The secret is
   shown once — store it safely (goes in the service's `.env`, never in the browser).

### 1.2 Choose scopes (least privilege)

Request only what's needed:
- `read` — always present; lets us call `viewer` to identify the user. *(required)*
- `comments:create` — post DQA comments onto tickets. *(required for our core loop)*
- `issues:create` — **only** if you also want the "no ticket mapped → create a new issue"
  fallback. Skip if every DQA page maps to an existing ticket.

Do **not** request `write` or `admin`. (Selling point to the team: DQA can read your
identity and add comments, and literally cannot edit or delete anything.)

### 1.3 Decide the actor mode

- **`user` (recommended):** comments are authored in Linear by the real reviewer. This is
  the default and what makes DQA comments feel native. Requires the service to store each
  user's access token (encrypted) so it can post on their behalf.
- **`application`:** simpler — no per-user token storage — but comments show as authored by
  "ENS DQA" with the reviewer's name in the body. Pick this if storing user tokens is a
  hassle for v1.

> **Decision needed:** `user` vs `application`. Default in this plan: **`user`**.

### 1.4 Find the IDs you'll whitelist against

You need a few Linear IDs for the `.env`. Easiest way: create **one personal API key**
just for this lookup (Settings → Security & access → Personal API keys), run the queries
below, then you can delete the key — end users never touch it.

```bash
# Workspace (organization) id — the coarse gate
curl -s https://api.linear.app/graphql -H "Authorization: <PERSONAL_KEY>" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ organization { id name urlKey } }"}'

# Team ids + keys (e.g. ENG) — medium gate
curl -s https://api.linear.app/graphql -H "Authorization: <PERSONAL_KEY>" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ teams { nodes { id key name } } }"}'

# Project ids — finest gate (the "specific project" you described)
curl -s https://api.linear.app/graphql -H "Authorization: <PERSONAL_KEY>" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ projects { nodes { id name } } }"}'
```

Save the `organization.id`, plus the `team.id` and/or `project.id` you want to gate on.

### 1.5 Summary of what Part 1 produces

| Value | Where it came from | Goes into |
|---|---|---|
| Client ID | OAuth app (1.1) | `.env` (server) |
| Client Secret | OAuth app (1.1) | `.env` (server, secret) |
| Callback URL(s) | OAuth app (1.1) | `.env` + matches redirect |
| Workspace/org id | query (1.4) | `.env` — workspace gate |
| Team id / Project id | query (1.4) | `.env` — finer gate |

### 1.6 New `.env` keys (added to the existing file)

```bash
# --- Linear OAuth (replaces the personal-key approach for end users) ---
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_REDIRECT_URI=http://localhost:4000/auth/callback
LINEAR_SCOPES=read,comments:create        # add issues:create only if using the fallback
LINEAR_ACTOR=user                          # or "application"

# --- Whitelist (set the strictness you want) ---
LINEAR_WORKSPACE_ID=                       # required — coarse gate
LINEAR_ALLOWED_TEAM_IDS=                   # optional, comma-separated
LINEAR_ALLOWED_PROJECT_IDS=                # optional, comma-separated

# --- Session ---
SESSION_SECRET=                            # random string to sign DQA session cookies/JWT
TOKEN_ENCRYPTION_KEY=                      # 32-byte key; only if LINEAR_ACTOR=user
```

The old `LINEAR_API_KEY` / `LINEAR_DRY_RUN` keys can stay for now as a fallback path while
we migrate, then be removed.

---

## Caveats

- Redirect URIs must match exactly — every host (localhost, tunnel, prod) needs to be
  registered in the OAuth app.
- Private teams/projects: the membership check only sees what the user can see — which is
  the behavior we want, but it depends on Linear's own visibility rules.
- Token lifetime: handle expiry/refresh and revoke so a removed teammate loses access.
- The client secret and user tokens live only on the server, never in `overlay.js`.

