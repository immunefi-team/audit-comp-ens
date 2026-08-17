# Review Context

The structured rules with id / scope / severity live in `config.json`
alongside this file. This file holds the prose context that doesn't fit
the structured format: severity behaviour, skip lists, and pointers to
exemplar files. The full `STYLEGUIDE.md` (repo root) is the deep-dive
reference — use it only when a rule in `config.json` doesn't fit.

## How to act per severity

- **`high`** — always flag. These map to STYLEGUIDE.md "🔴 Must" rules.
- **`medium`** — flag unless the author left a justifying inline
  comment (see STYLEGUIDE.md "Breaking the Rules"). These map to "🟡
  Default".
- **`low`** — flag only if violated repeatedly across the PR or if it
  significantly hurts readability. These map to "🟢 Guideline".

Before flagging any violation, check whether the surrounding lines
include a `// biome-ignore`, `// greptile:`, or short explanatory
comment justifying the deviation.

## What to skip entirely

- Crowdin-generated translation files (`**/translations/**`,
  `**/locales/**`, `**/*.po`).
- Generated code, lock files, formatting-only diffs.
- React StrictMode double-execution behaviour — never flag this as a
  bug, never suggest caching or flags to prevent it.
- `useConnection()` vs `useAccount()` for getting `address` — both are
  valid wagmi v3 hooks; never flag this distinction.
- Stylistic changes already enforced by Biome — don't restate them
  inline.
- Cognitive complexity / "this function does too much" — enforced by
  Biome's `noExcessiveCognitiveComplexity` (threshold 15). Don't flag
  raw line-count complexity inline; rely on `file-length` only as a
  structural "look here" signal.
- Structural tripwires (`file-length`, `component-prop-count`,
  `one-component-per-file`) never apply to test files
  (`**/*.test.ts(x)`), mocks (`**/*.mock.ts`, `**/MOCK.ts`), or
  Storybook stories (`**/*.stories.tsx`). Story files intentionally
  export multiple example components and pass many props — that is not
  a smell. Generated files are excluded globally via `ignorePatterns`
  in `config.json` and are never reviewed at all.
  > These per-rule exemptions live here in prose (not in each rule's
  > `scope`) because Greptile `scope` globs do not support negation,
  > and a global `ignorePatterns` entry would wrongly suppress *all*
  > rules (e.g. `no-any`) on test files — we only want the structural
  > tripwires skipped there, not every check.

## Comment style

- Reference the rule `id` from `config.json` when flagging.
- Include a brief code suggestion showing the correct pattern.
- Never post praise or positive observations as inline comments —
  those belong in the PR summary only.
- Be concise and actionable. Prose explanations belong in
  `STYLEGUIDE.md`, not in review comments.

## Monorepo awareness

- Changes should stay within the relevant `apps/*` directory unless
  the change genuinely requires shared code.
- Shared code under `packages/` should be justified.
- `packages/transaction-manager/CLAUDE.md` defines extra neverthrow +
  XState rules — check it when reviewing changes inside that package.

## Exemplar files (positive references)

When a rule doesn't fit cleanly, point reviewers at a working example
in the codebase instead of restating the rule:

- `apps/portal/src/features/profile/hooks/useEnsOwner.ts` —
  `resultQueryOptions` factory pattern.
- `apps/portal/src/features/records/hooks/useEditRecordsState.ts` —
  React state + pure helpers split.
- `apps/portal/src/features/renew/utils/computeNamePricingDisplay.ts` —
  pure function with co-located tests.
