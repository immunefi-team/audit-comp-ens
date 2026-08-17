export const WEAVING_DPR = 2

export const RECT_ASPECT_DEFAULT = 36 / 40

export interface WeaveGradient {
  startShade: number
  endShade: number
  direction: number
  range: [number, number]
}

export const PALETTE_RGBA: number[][][] = [
  [
    [0.247, 0.114, 0.035, 1],
    [0.596, 0.302, 0.106, 1],
    [0.973, 0.969, 0.886, 1],
    [0.855, 0.725, 0.525, 1],
    [0, 0, 0, 0],
  ],
  [
    [0.322, 0.024, 0.141, 1],
    [0.941, 0.216, 0.576, 1],
    [0.984, 0.922, 0.941, 1],
    [0.988, 0.706, 0.812, 1],
    [0, 0, 0, 0],
  ],
  [
    [0.008, 0.161, 0.231, 1],
    [0.0, 0.502, 0.737, 1],
    [0.902, 0.953, 0.973, 1],
    [0.455, 0.725, 0.875, 1],
    [0, 0, 0, 0],
  ],
  [
    [0.012, 0.188, 0.063, 1],
    [0.0, 0.486, 0.137, 1],
    [0.843, 0.914, 0.89, 1],
    [0.4549, 0.6745, 0.4902, 1],
    [0, 0, 0, 0],
  ],
  [
    [0.098039, 0.098039, 0.098039, 1],
    [0.34902, 0.341176, 0.333333, 1],
    [0.933333, 0.929412, 0.929412, 1],
    [0.45098, 0.45098, 0.45098, 1],
    [0, 0, 0, 0],
  ],
]

export type Rgba = [number, number, number, number]

export function getPaletteColor(
  paletteIndex: number,
  shadeIndex: number,
): Rgba {
  const p = Math.max(0, Math.min(4, Math.floor(paletteIndex)))
  const s = Math.max(0, Math.min(4, Math.floor(shadeIndex)))
  return (PALETTE_RGBA[p]?.[s] ?? [0, 0, 0, 1]) as Rgba
}

export const WEAVE_DEFAULTS = {
  pattern: 0,
  palette: 0,
  bgShade: 2,
  warpShade: 1,
  weftShade: 3,
  gridSize: 32,
  gradSteps: 0,
  rectAspect: RECT_ASPECT_DEFAULT,
  cornerRadius: 0.18,
  warpGradient: {
    startShade: 0,
    endShade: 3,
    direction: 0,
    range: [0, 100],
  } as WeaveGradient,
  weftGradient: {
    startShade: 0,
    endShade: 3,
    direction: 0,
    range: [0, 100],
  } as WeaveGradient,
  warpGradientEnabled: true,
  weftGradientEnabled: true,
  shimmer: false,
  shimmerSpeed: 2,
  shimmerWidth: 2,
  shimmerIntensity: 0.25,
  shimmerPosition: 0,
  shimmerRotation: 0.125,
  shimmerNoise: 0.3,
  shimmerNoiseSeed: 0,
  shimmerNoiseMin: 0.5,
  shimmerNoiseMax: 1.5,
  shimmerBlendMode: 0,
  useAllColorways: true,
  colorwaySeed: 78.2,
  colorwayNoiseScale: 0.005,
  colorwayNoiseMode: 2,
  colorwayNoiseOctaves: 3,
  colorwayNoisePersistence: 0.6,
  colorwayNoiseLacunarity: 2.1,
  colorwayNoiseBias: 0.67,
  colorwayNoiseX: 0,
  colorwayBleedAnisotropy: 0.6,
  colorwayBleedRotation: 0.5,
  colorwayBleedCrossFiber: 0,
  colorwayBleedDraftCoupled: true,
  colorwayIncludeMask: 31,
  stitchRevealMode: 0,
  stitchRevealProgress: 1,
  stitchRevealSeed: 0,
  stitchRevealScale: 0.12,
  stitchRevealNoiseScale: 1,
  stitchRevealSoftness: 0.06,
  stitchRevealBleedAnisotropy: 3,
  stitchRevealBleedRotation: 0,
  stitchRevealBleedCrossFiber: 0.2,
  stitchRevealBleedDraftCoupled: 0,
}

export type WeaveDefaults = typeof WEAVE_DEFAULTS
