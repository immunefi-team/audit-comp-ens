/**
 * QA-only DQA overlay config. `import.meta.env` is statically inlined per
 * consuming app by Vite, so these resolve to each app's own env at build time.
 *
 * NOTE — unlike dev-time-travel this is deliberately NOT gated on
 * `import.meta.env.DEV`: QA / PR-preview deployments are production-mode
 * builds, and DQA must work there. Safety instead comes from the flag being
 * a build-time constant: production pipelines never set `VITE_DQA`, so Vite
 * inlines it as `undefined` and the guard compiles to a statically-false
 * `return false` — the injector can never run in a production bundle.
 * NEVER set `VITE_DQA` in a production deploy.
 */

/** Origin of the @ens-apps/dqa-server instance serving `overlay.js`. */
export const DQA_URL: string =
  (import.meta.env.VITE_DQA_URL as string | undefined) ??
  'http://localhost:4000'

/** Optional Linear ticket (e.g. "ENG-123") that comments thread onto. */
export const DQA_LINEAR_ISSUE: string | undefined = import.meta.env
  .VITE_DQA_LINEAR_ISSUE as string | undefined

/** True only in builds with the flag set; statically false otherwise. */
export function isDQAEnabled(): boolean {
  return import.meta.env.VITE_DQA === '1' || import.meta.env.VITE_DQA === 'true'
}

/** Mock-only UI — no DQA server; full inbox with sample data. */
export function isDqaMockUiEnabled(): boolean {
  return (
    import.meta.env.VITE_DQA_MOCK_UI === '1' ||
    import.meta.env.VITE_DQA_MOCK_UI === 'true'
  )
}
