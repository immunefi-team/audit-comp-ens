export { FilledGlyph, type FilledGlyphProps } from './FilledGlyph'
export {
  type UseRafProgressOptions,
  useRafProgress,
} from './hooks/useRafProgress'
export {
  type CreateRafProgressStoreOptions,
  createRafProgressStore,
  type RafProgressAdvance,
  type RafProgressStore,
} from './lib/rafProgressStore'
export { NameFill, type NameFillProps } from './NameFill'
export {
  HOUNDSTOOTH_SHIMMER_OPTIONS,
  JACQUARD_PATTERN3_DYE_BLEED_OPTIONS,
  JACQUARD_PATTERN6_DYE_BLEED_OPTIONS,
  JACQUARD_SHADERBOX_2_OPTIONS,
  WEAVE_PROGRESS_BAR_OPTIONS,
} from './presets'
export { PATTERNS, type WeavePattern } from './shader/patterns'
export type { WeaveShaderOptions } from './shader/useWeaveShader'
export { WEAVE_DEFAULTS } from './shader/weaveConfig'
export { WeaveCanvas, type WeaveCanvasProps } from './WeaveCanvas'
export {
  WeaveLoader,
  type WeaveLoaderProps,
  type WeaveStep,
} from './WeaveLoader'
export { WeaveName, type WeaveNameProps } from './WeaveName'
export {
  WEAVE_PROGRESS_BAR_HEIGHT,
  WEAVE_PROGRESS_BAR_RADIUS,
  WeaveProgressBar,
  type WeaveProgressBarProps,
} from './WeaveProgressBar'
export {
  WEAVE_REGISTRATION_HEADLINE_NAME_GAP_MIN_PX,
  WEAVE_REGISTRATION_LONG_NAME,
  WEAVE_REGISTRATION_NAME_FILL,
  WEAVE_REGISTRATION_NAME_FILL_COMPACT,
  WEAVE_REGISTRATION_NAME_FILL_SMALL_FONT_THRESHOLD,
  weaveRegistrationNameFillFor,
} from './weaveNameFill'
