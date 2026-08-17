import {
  getPremiumPriceAtInstant,
  type PremiumDecayConfig,
} from './premiumDecay'

/** Pixel geometry of the chart's viewBox. */
export type ChartGeometry = {
  readonly width: number
  readonly height: number
  readonly padding: number
}

/** A resolved point on the premium decay curve. */
export type PremiumChartPoint = {
  /** Position within the premium window, 0 (start) to 1 (end). */
  readonly fraction: number
  readonly instant: Temporal.Instant
  /** Premium in USD at that instant. */
  readonly price: number
  /** viewBox x coordinate. */
  readonly x: number
  /** viewBox y coordinate. */
  readonly y: number
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const innerWidth = (g: ChartGeometry) => g.width - g.padding * 2
const innerHeight = (g: ChartGeometry) => g.height - g.padding * 2

/** Map a window fraction [0,1] to a viewBox x coordinate. */
export const fractionToX = (
  fraction: number,
  geometry: ChartGeometry,
): number => geometry.padding + clamp(fraction, 0, 1) * innerWidth(geometry)

/** Map a viewBox x coordinate back to a window fraction [0,1]. */
export const xToFraction = (x: number, geometry: ChartGeometry): number =>
  clamp((x - geometry.padding) / innerWidth(geometry), 0, 1)

/** Map a premium price to a viewBox y coordinate (higher price = higher up). */
export const priceToY = (
  price: number,
  startPriceUsd: number,
  geometry: ChartGeometry,
): number =>
  geometry.padding +
  innerHeight(geometry) -
  (price / startPriceUsd) * innerHeight(geometry)

/**
 * Resolve the curve point at a position `fraction` [0,1] of the premium window.
 * The epoch is rounded because `Temporal.Instant.fromEpochMilliseconds`
 * requires an integer.
 */
export const premiumPointAtFraction = (
  premiumStart: Temporal.Instant,
  config: PremiumDecayConfig,
  fraction: number,
  geometry: ChartGeometry,
): PremiumChartPoint => {
  const clamped = clamp(fraction, 0, 1)
  const instant = Temporal.Instant.fromEpochMilliseconds(
    Math.round(premiumStart.epochMilliseconds + clamped * config.periodMs),
  )
  const price = getPremiumPriceAtInstant(premiumStart, instant, config)
  return {
    fraction: clamped,
    instant,
    price,
    x: fractionToX(clamped, geometry),
    y: priceToY(price, config.startPriceUsd, geometry),
  }
}

/** Evenly-sampled curve points (`samples + 1` of them) for the SVG polyline. */
export const premiumCurvePoints = (
  premiumStart: Temporal.Instant,
  config: PremiumDecayConfig,
  geometry: ChartGeometry,
  samples: number,
): PremiumChartPoint[] =>
  Array.from({ length: samples + 1 }, (_, i) =>
    premiumPointAtFraction(premiumStart, config, i / samples, geometry),
  )

/** Fraction [0,1] of the premium window that `now` falls on. */
export const nowFraction = (
  premiumStart: Temporal.Instant,
  config: PremiumDecayConfig,
  now: Temporal.Instant = Temporal.Now.instant(),
): number =>
  clamp(
    (now.epochMilliseconds - premiumStart.epochMilliseconds) / config.periodMs,
    0,
    1,
  )

/** Convert a pointer's clientX over the chart element to a window fraction. */
export const clientXToFraction = (
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  geometry: ChartGeometry,
): number =>
  xToFraction(((clientX - rectLeft) / rectWidth) * geometry.width, geometry)

/** Serialize curve points to an SVG `points` attribute string. */
export const toPolylinePoints = (
  points: readonly PremiumChartPoint[],
): string => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
