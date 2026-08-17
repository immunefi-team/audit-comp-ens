# Code Review Guidelines

## Primary sources

- **`.greptile/config.json`** — structured atomic rules with id, scope,
  and severity. Greptile's native rule engine reads this.
- **`.greptile/rules.md`** — prose context: severity behaviour, what to
  skip, exemplar files.

Start with these two files. They are the source of truth for what gets
flagged in PR review.

## Reference sources

- **`STYLEGUIDE.md`** — the full coding standards with rationale and
  worked examples. Consult only when a rule in `.greptile/config.json`
  doesn't fit, or for broader context.
- **`CLAUDE.md`** files — project and package-level instructions,
  including `packages/transaction-manager/CLAUDE.md` for neverthrow +
  XState patterns inside that package.

## Severity mapping

`config.json` rule severities map to STYLEGUIDE.md tiers:

- **`high`** ≡ STYLEGUIDE 🔴 Must — always flag.
- **`medium`** ≡ STYLEGUIDE 🟡 Default — flag unless justified by an
  inline code comment.
- **`low`** ≡ STYLEGUIDE 🟢 Guideline — flag only when repeated or when
  it significantly hurts readability.

## Documented exceptions

The STYLEGUIDE.md "Breaking the Rules" section allows any rule to be
intentionally broken when justified with a code comment. Before flagging
a violation, check whether the author left a justifying comment on or
near the line. If so, do not flag it.

## Comment style

- Reference the rule `id` from `config.json` (e.g. `no-effect-data-fetching`).
- Include a brief code suggestion showing the correct pattern.
- Never post praise or positive observations as inline comments —
  positive observations belong only in the PR summary.
- Be concise and actionable.

## What to skip

See "What to skip entirely" in `.greptile/rules.md`.

## Monorepo awareness

- Changes should stay within the relevant `apps/*` directory unless the
  change genuinely requires shared code.
- Shared code under `packages/` should be justified.
- Check package-specific `CLAUDE.md` files for additional context
  (notably `packages/transaction-manager/CLAUDE.md`).
