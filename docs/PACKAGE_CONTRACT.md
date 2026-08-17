# Package Contract

This document defines the package and script contract for this monorepo.

The goals are:
- Keep package behavior predictable across apps, workers, and libraries.
- Encode correctness-critical dependencies in package scripts (`pre*` hooks).
- Use pnpm filters for CI optimization, not as the only source of correctness.
- Keep enforcement manual for now (no automated contract validator in CI).

## Roles

### `leaf-app`
Deployable app that is not consumed as a package by other workspaces.

Current examples:
- `apps/manager`
- `apps/portal`
- `apps/api-worker` (avatar worker)

### `hybrid-exporter`
Deployable app/worker that is also consumed by other workspaces.

Current example:
- `workers/api-worker` (exports `api-worker/hc` and `api-worker/types`)

### `source-lib`
Library consumed directly from source files. Build artifacts are not required.

Current examples:
- `packages/utils`
- `packages/indexer`
- `packages/l2-primary`
- `packages/transaction-manager`
- `packages/locales` (data-only package)

### `built-lib`
Library consumed from generated artifacts.

Current examples:
- None currently (reserved role).

## Script Contract

Baseline script names used across the repo:
- `dev`
- `build`
- `typecheck`
- `test`
- `test:coverage`
- `build:types`
- `deploy`
- `cf-typegen`

### Required vs optional by role

| Role | Required | Optional | Notes |
| --- | --- | --- | --- |
| `leaf-app` | `dev`, `build` | `typecheck`, `test`, `test:coverage`, `deploy`, `cf-typegen` | Add `typecheck` for TypeScript-heavy apps (for example `manager` and `portal`). |
| `hybrid-exporter` | `dev`, `build`, `typecheck`, `build:types` | `test`, `test:coverage`, `deploy`, `cf-typegen` | `build:types` must emit declarations/contracts consumed by dependents. |
| `source-lib` | `typecheck` (except data-only packages) | `test`, `test:coverage`, `dev` | `build` should generally be absent. |
| `built-lib` | `build`, `typecheck` | `build:types`, `test`, `test:coverage` | Use when consumers require generated runtime artifacts. |

### Naming and alias guidance

- Keep canonical names above for shared tooling and workflows.
- Extra package-specific scripts are allowed (`dev:inspect`, `build-storybook`, etc.).
- Root-level scripts in `/package.json` are orchestration conveniences only.

## Pre/Post Script Rules

Use npm/pnpm lifecycle hooks intentionally:
- `pre<task>`: required prerequisite for `<task>`.
- `post<task>`: non-critical follow-up only.

Rules:
- Put correctness-critical dependencies in `pre*` hooks.
- Do not rely on `post*` for required setup.
- Keep `pre*` hooks idempotent.

### Current required example

`apps/manager/package.json`:
- `pretypecheck` runs `pnpm --filter api-worker run build:types`

This guarantees manager typecheck has the exported API worker declarations.

## pnpm Filter Reference

### Selector semantics

- `foo...`: `foo` and its dependencies
- `...foo`: `foo` and its dependents
- `foo^...`: dependencies of `foo` only (exclude `foo`)
- `...^foo`: dependents of `foo` only (exclude `foo`)
- `[origin/main]`: packages changed since merge-base with `origin/main`
