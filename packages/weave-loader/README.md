# @ens-apps/weave-loader

Standalone weave loader: WebGL woven-fabric shader, animated name fill, and progress
primitives for ENS apps. The manager integration lives in
`apps/manager/src/features/weave-registration/` (`WeaveRegistration.tsx`,
`lib/useForwardProgress.ts`, `lib/weaveSteps.ts`), wired from
`apps/manager/src/features/register-v2/workflow/registering/RegisteringStep.tsx`.

Matches the Figma design (ENS App Beta, node `1209-29493`).

## User-facing flow

1. **Notification settings visible.** Header shows `WeaveProgressBar` (static weave,
   CSS width animation only) with a "Registering name" label whose trailing dots cycle
   via [`calligraph`](https://github.com/raphaelsalaja/calligraph).
2. **Notifications dismissed.** Full-screen `WeaveRegistration`: woven square on the
   left, step label + filling name on the right. Optional description (cooldown) and
   footer (Continue) render below the section so they never shift layout.
3. **Completion.** Fill sweeps to 100%, then Continue appears. The centered loader can
   hold briefly until the name fill settles (`onFillSettled`) before switching to
   registration details.
4. **Failure / rejection.** Route unmounts the loader; all rAF loops stop with it.

## Components

### `NameFill`

HTML text that fills in reading order across wrapped lines. Each grapheme is a
[`FilledGlyph`](./src/FilledGlyph.tsx) — grey base + fill layer clipped horizontally via
`clip-path: inset(...)`. Layout uses `Range` on a hidden probe string;
[`segmentGraphemes`](./src/nameFillLayout.ts) keeps measurement and rendering aligned
(`Intl.Segmenter` with `Array.from` fallback).

- Disable `animate` when an external driver updates `progress` every frame (manager
  passes `animate={false}` during the main registration wait; enables it only for the
  completion hold sweep).

### `WeaveCanvas` + `shader/`

Memoized canvas; parent progress ticks do not re-mount GL.

- **Production:** `WeaveCanvas` imports `shader/fragment.prod.glsl` (~350 lines) — weave
  grid, colorways/gradients, weave-in reveal, optional shimmer. No ENS mark, hover
  ripple, or stitch reveal.
- **Sandbox / Storybook:** `WeaveCanvasSandbox` imports the full `fragment.glsl`
  (~584 lines) for shader tuning.
- `shader/useWeaveShader.ts` — shared runtime for both; options live in a ref so GL
  context is not torn down on every prop change.

### `WeaveProgressBar`

Thin rounded bar whose fill is woven fabric. `WEAVE_PROGRESS_BAR_OPTIONS` sets
`shimmer: false` and **`animated: false`** so the WebGL loop renders once (and on
resize), not at rAF cadence. RegisteringStep passes `animate={false}` for the CSS
width transition as well.

### Presets (`presets.ts`)

- `JACQUARD_PATTERN6_DYE_BLEED_OPTIONS` — live registration square (dye-bleed
  colorways, bias/noise animation; shimmer off).
- `WEAVE_PROGRESS_BAR_OPTIONS` — static header bar.
- `HOUNDSTOOTH_SHIMMER_OPTIONS` — demo / stories with shimmer sweep.

### `WeaveName` / `WeaveLoader`

Alternative shader-masked name treatment. Not used in the live registration path
(`NameFill` is simpler and cheaper).

## Performance & resilience

Review feedback on an earlier iteration is addressed as follows:

| Concern | Status |
|---|---|
| **1. Unconditional WebGL rAF loop** | **Fixed.** `WeaveShaderOptions.animated` (default `true`) gates the loop. When `animated: false`, `ensureLoop` draws a single frame and cancels rAF. Also pauses when the tab is hidden (`visibilitychange`) or the canvas is off-screen (`IntersectionObserver`). Progress bar preset uses `animated: false`. |
| **2. `preserveDrawingBuffer: true`** | **Removed.** Context attrs are `alpha`, `antialias: false`, `powerPreference: 'low-power'`. No backbuffer preservation. |
| **3. Shimmer phase static (`u_shimmerPhase`)** | **Fixed in prod shader.** Production GLSL drives band position from `u_shimmerTime` only (`bandCenter = mod(floor(u_shimmerTime * speed) + …)`). The broken `u_shimmerPhase` uniform exists only in the sandbox shader. |
| **4. No WebGL / compile fallback** | **Fixed.** `WeaveFallback` renders a static brand gradient; the canvas is hidden on error. Shader/compiler output is logged in dev only (`import.meta.env.DEV`). |
| **5. Reduced motion not in live path** | **Fixed.** `WeaveRegistration` calls `usePrefersReducedMotion` and sets `{ shimmer: false, animated: false }` on weave options plus disables `NameFill` animation. |
| **6. Over-featured production shader** | **Fixed.** Split: `fragment.prod.glsl` for `WeaveCanvas`, full `fragment.glsl` for `WeaveCanvasSandbox` only. |
| **7. Eager shader bundle** | **Fixed.** `RegisteringStep` lazy-loads `WeaveRegistration` and `WeaveProgressBar` via `React.lazy` + `Suspense` with a lightweight CSS placeholder. |
| **8. NameFill re-renders every frame** | **Mitigated.** Line-based clip updates at rAF cadence (~60 fps). Per-line reconciliation remains; profile long names on mid-tier mobile if 255-char names are common. |
| **9. Unicode / grapheme handling** | **Fixed.** `segmentGraphemes()` used consistently for measure and render. |

**Intentional cost:** The centered registration square (`JACQUARD_PATTERN6_DYE_BLEED_OPTIONS`)
runs an animated rAF loop when visible and motion is allowed — colorway bias/noise
animation is the live decorative effect. That is expected; static surfaces (progress bar,
reduced motion, hidden/off-screen) do not pay continuous GPU time.

## rAF progress store

`lib/rafProgressStore.ts` + `hooks/useRafProgress.ts` — generic subscribe-driven
scalar animation (no `useEffect`). Pass a pure `advance(context, current, dt)` function;
the store runs rAF while subscribed and exposes snapshots for `useSyncExternalStore`.

Manager registration uses this via `features/weave-registration/lib/useForwardProgress.ts`
with registration-specific pacing in `forwardProgressMath.ts`.

## Progress driver (manager app)

`useForwardProgress` shapes machine stage progress into a monotonic display value paced
around the commitment cooldown. See `forwardProgressMath.ts` for band tables and speed
rules. It feeds both the header bar and `WeaveRegistration`.

## Step copy

Translated step labels live in manager `weaveSteps.ts` (lingui `msg` descriptors).
This package's `WeaveLoader` accepts pre-resolved `{ label, end }` steps.

## Stories

Manager Storybook: `Features/WeaveRegistration/WeaveRegistration` (including completion-hold
transition stories), `Components/WeaveLoader/*`.

```bash
pnpm --filter manager storybook:dev
```
