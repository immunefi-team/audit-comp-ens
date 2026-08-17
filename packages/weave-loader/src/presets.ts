import type { WeaveShaderOptions } from './shader/useWeaveShader'

export const HOUNDSTOOTH_SHIMMER_OPTIONS: WeaveShaderOptions = {
  pattern: 13,
  useAllColorways: true,
  gridSize: 40,
  shimmer: true,
  shimmerWidth: 12,
  shimmerIntensity: 0.6,
  skipWeaveInReveal: true,
}

/**
 * Jacquard shaderbox 2 export — palette 4, dye-bleed all-colorways, bias play loop.
 * @see https://github.com/ali-rasheed/Jacquard
 */
export const JACQUARD_SHADERBOX_2_OPTIONS: WeaveShaderOptions = {
  pattern: 0,
  palette: 4,
  bgShade: 2,
  warpShade: 1,
  weftShade: 3,
  gridSize: 32,
  warpGradientEnabled: true,
  weftGradientEnabled: true,
  gradSteps: 0,
  rectAspect: 0.9,
  cornerRadius: 0.18,
  shimmer: false,
  useAllColorways: true,
  colorwaySeed: 78.2,
  colorwayNoiseScale: 0.005,
  colorwayNoiseMode: 2,
  colorwayNoiseOctaves: 3,
  colorwayNoisePersistence: 0.6,
  colorwayNoiseLacunarity: 2.1,
  colorwayNoiseBias: 2.4239033707912974,
  colorwayNoiseX: 0,
  colorwayBleedAnisotropy: 0.6,
  colorwayBleedRotation: 0.5,
  colorwayBleedCrossFiber: 0,
  colorwayBleedDraftCoupled: true,
  colorwayIncludeMask: 15,
  animateColorwayBias: true,
  skipWeaveInReveal: true,
  colorwayAnimLoop: true,
  colorwayAnimRandomizeOnLoop: true,
  animated: true,
}

const JACQUARD_PATTERN6_DYE_BLEED_BASE: WeaveShaderOptions = {
  pattern: 6,
  palette: 0,
  bgShade: 2,
  warpShade: 1,
  weftShade: 3,
  warpGradientEnabled: true,
  weftGradientEnabled: true,
  gradSteps: 0,
  shimmer: false,
  useAllColorways: true,
  colorwaySeed: 78.2,
  colorwayNoiseScale: 0.071,
  colorwayNoiseMode: 2,
  colorwayNoiseOctaves: 3,
  colorwayNoisePersistence: 0.6,
  colorwayNoiseLacunarity: 2.1,
  colorwayNoiseBias: 0.5709147727252404,
  colorwayNoiseX: 40.1,
  colorwayBleedAnisotropy: 10.1,
  colorwayBleedRotation: 0.5,
  colorwayBleedCrossFiber: 0,
  colorwayBleedDraftCoupled: true,
  colorwayIncludeMask: 15,
  animateColorwayBias: true,
  skipWeaveInReveal: true,
  colorwayAnimLoop: true,
  animated: true,
}

/**
 * Jacquard pattern 6 export — dye bleed, high bleed anisotropy, bias + noise X play.
 * @see https://github.com/ali-rasheed/Jacquard
 */
export const JACQUARD_PATTERN6_DYE_BLEED_OPTIONS: WeaveShaderOptions = {
  ...JACQUARD_PATTERN6_DYE_BLEED_BASE,
  gridSize: 32,
  rectAspect: 0.9,
  cornerRadius: 0.18,
  animateColorwayNoiseX: true,
  colorwayAnimRandomizeOnLoop: true,
}

export const JACQUARD_PATTERN3_DYE_BLEED_OPTIONS: WeaveShaderOptions = {
  pattern: 3,
  palette: 4,
  bgShade: 2,
  warpShade: 1,
  weftShade: 3,
  gridSize: 64,
  warpGradientEnabled: true,
  weftGradientEnabled: true,
  gradSteps: 0,
  rectAspect: 0.9,
  cornerRadius: 0.18,
  shimmer: false,
  useAllColorways: true,
  colorwaySeed: 78.2,
  colorwayNoiseScale: 0.005,
  colorwayNoiseMode: 2,
  colorwayNoiseOctaves: 3,
  colorwayNoisePersistence: 0.6,
  colorwayNoiseLacunarity: 2.1,
  colorwayNoiseBias: 1.8128295454546408,
  colorwayNoiseX: 0,
  colorwayBleedAnisotropy: 0.6,
  colorwayBleedRotation: 0.5,
  colorwayBleedCrossFiber: 0,
  colorwayBleedDraftCoupled: true,
  colorwayIncludeMask: 31,
  animateColorwayBias: true,
  skipWeaveInReveal: true,
  colorwayAnimLoop: true,
  colorwayAnimRandomizeOnLoop: false,
  animated: true,
}

export const WEAVE_PROGRESS_BAR_OPTIONS: WeaveShaderOptions = {
  ...JACQUARD_PATTERN6_DYE_BLEED_BASE,
  gridSize: 2,
  rectAspect: 1,
  cornerRadius: 0,
  colorwayNoiseOctaves: 2,
}
