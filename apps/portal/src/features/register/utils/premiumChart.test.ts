import { describe, expect, it } from 'vitest'
import {
  type ChartGeometry,
  clientXToFraction,
  fractionToX,
  nowFraction,
  premiumCurvePoints,
  premiumPointAtFraction,
  priceToY,
  toPolylinePoints,
  xToFraction,
} from './premiumChart'
import type { PremiumDecayConfig } from './premiumDecay'

const DAY_MS = 24 * 60 * 60 * 1000

const CONFIG: PremiumDecayConfig = {
  startPriceUsd: 100_000_000,
  halvingPeriodMs: DAY_MS,
  periodMs: 21 * DAY_MS,
}

const GEOMETRY: ChartGeometry = { width: 300, height: 120, padding: 6 }

const START = Temporal.Instant.fromEpochMilliseconds(0)

describe('fractionToX / xToFraction', () => {
  it('maps the window edges to the padded chart edges', () => {
    expect(fractionToX(0, GEOMETRY)).toBe(6)
    expect(fractionToX(1, GEOMETRY)).toBe(294)
    expect(fractionToX(0.5, GEOMETRY)).toBe(150)
  })

  it('clamps out-of-range fractions', () => {
    expect(fractionToX(-1, GEOMETRY)).toBe(6)
    expect(fractionToX(2, GEOMETRY)).toBe(294)
  })

  it('is the inverse of fractionToX', () => {
    expect(xToFraction(6, GEOMETRY)).toBeCloseTo(0)
    expect(xToFraction(294, GEOMETRY)).toBeCloseTo(1)
    expect(xToFraction(150, GEOMETRY)).toBeCloseTo(0.5)
  })

  it('clamps x outside the chart to [0,1]', () => {
    expect(xToFraction(-50, GEOMETRY)).toBe(0)
    expect(xToFraction(999, GEOMETRY)).toBe(1)
  })
})

describe('priceToY', () => {
  it('puts the start price at the top and zero at the bottom', () => {
    expect(priceToY(CONFIG.startPriceUsd, CONFIG.startPriceUsd, GEOMETRY)).toBe(
      6,
    )
    expect(priceToY(0, CONFIG.startPriceUsd, GEOMETRY)).toBe(114)
    expect(
      priceToY(CONFIG.startPriceUsd / 2, CONFIG.startPriceUsd, GEOMETRY),
    ).toBe(60)
  })
})

describe('premiumPointAtFraction', () => {
  it('decreases in price from window start to end', () => {
    const start = premiumPointAtFraction(START, CONFIG, 0, GEOMETRY)
    const end = premiumPointAtFraction(START, CONFIG, 1, GEOMETRY)
    expect(start.price).toBeGreaterThan(end.price)
    expect(end.price).toBeGreaterThanOrEqual(0)
  })

  it('derives x and y consistently with the geometry helpers', () => {
    const point = premiumPointAtFraction(START, CONFIG, 0.25, GEOMETRY)
    expect(point.x).toBe(fractionToX(0.25, GEOMETRY))
    expect(point.y).toBe(priceToY(point.price, CONFIG.startPriceUsd, GEOMETRY))
  })

  it('clamps the fraction and rounds the epoch to an integer', () => {
    const point = premiumPointAtFraction(START, CONFIG, 1.5, GEOMETRY)
    expect(point.fraction).toBe(1)
    expect(Number.isInteger(point.instant.epochMilliseconds)).toBe(true)
  })
})

describe('premiumCurvePoints', () => {
  it('returns samples + 1 monotonically non-increasing points', () => {
    const points = premiumCurvePoints(START, CONFIG, GEOMETRY, 8)
    expect(points).toHaveLength(9)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].price).toBeLessThanOrEqual(points[i - 1].price)
    }
  })
})

describe('nowFraction', () => {
  it('is the elapsed share of the window', () => {
    const now = Temporal.Instant.fromEpochMilliseconds(CONFIG.periodMs / 2)
    expect(nowFraction(START, CONFIG, now)).toBeCloseTo(0.5)
  })

  it('clamps before the start and after the end', () => {
    expect(
      nowFraction(
        START,
        CONFIG,
        Temporal.Instant.fromEpochMilliseconds(-DAY_MS),
      ),
    ).toBe(0)
    expect(
      nowFraction(
        START,
        CONFIG,
        Temporal.Instant.fromEpochMilliseconds(CONFIG.periodMs + DAY_MS),
      ),
    ).toBe(1)
  })
})

describe('clientXToFraction', () => {
  it('maps a pointer position over the element to a window fraction', () => {
    // Pointer at the horizontal middle of a 600px-wide element.
    expect(clientXToFraction(300, 0, 600, GEOMETRY)).toBeCloseTo(0.5)
    // Pointer at the left padding edge.
    expect(clientXToFraction(0, 0, 600, GEOMETRY)).toBe(0)
  })
})

describe('toPolylinePoints', () => {
  it('serializes points to a space-separated `x,y` string', () => {
    const points = premiumCurvePoints(START, CONFIG, GEOMETRY, 1)
    expect(toPolylinePoints(points)).toMatch(
      /^\d+\.\d,\d+\.\d \d+\.\d,\d+\.\d$/,
    )
  })
})
