// ---------------------------------------------------------------------------
// Premium decay math
//
// Pure functions + types for the temporary-premium decay curve: price/day/point
// conversions, chart geometry, leader-line placement, and label formatting.
// No React or DOM here — kept framework-free so it can be unit-tested and
// reused by the chart component, the banner, and the hover/selection hook.
// ---------------------------------------------------------------------------

export const PREMIUM_START_PRICE = 100_000_000
export const PREMIUM_OFFSET = 47.6837158203125
export const PREMIUM_FACTOR = 0.5
export const PREMIUM_DURATION_MS = 21 * 24 * 60 * 60 * 1000
export const PREMIUM_DAYS = 21
export const PREMIUM_RESOLUTION = 65536
export const PREMIUM_RES_PER_DAY = PREMIUM_RESOLUTION / PREMIUM_DAYS

export function priceAtDay(day: number): number {
  return Math.max(
    PREMIUM_START_PRICE * PREMIUM_FACTOR ** day - PREMIUM_OFFSET,
    0,
  )
}

/** Highest premium on the decay curve — at window start (day 0), below the $100M label. */
export function getPremiumMaxPrice(): number {
  return priceAtDay(0)
}

export function dayAtPrice(price: number): number {
  const p = Math.max(0, price)
  return (
    Math.log((p + PREMIUM_OFFSET) / PREMIUM_START_PRICE) /
    Math.log(PREMIUM_FACTOR)
  )
}

export function pointAtPrice(price: number): number {
  const maxPrice = getPremiumMaxPrice()
  const clamped = Math.min(Math.max(0, price), maxPrice)
  const point = Math.floor(dayAtPrice(clamped) * PREMIUM_RES_PER_DAY)
  return Math.min(Math.max(0, point), PREMIUM_RESOLUTION)
}

export function pointAtDate(date: Date, startDate: Date): number {
  return Math.round(
    ((date.getTime() - startDate.getTime()) / PREMIUM_DURATION_MS) *
      PREMIUM_RESOLUTION,
  )
}

export function dateAtPoint(point: number, startDate: Date): Date {
  const relativeMs = (point / PREMIUM_RES_PER_DAY) * 86_400_000
  return new Date(startDate.getTime() + relativeMs)
}

export type ChartGeometry = {
  width: number
  height: number
  padding: number
}

export type PointPosition = {
  x: number
  y: number
  price: number
}

export function posAtPoint(point: number, geo: ChartGeometry): PointPosition {
  const { width, height, padding } = geo
  const yChunk = PREMIUM_START_PRICE / (height - padding * 2)
  const x = (point * (width - padding * 2)) / PREMIUM_RESOLUTION + padding
  const price = priceAtDay(point / PREMIUM_RES_PER_DAY)
  const y = -(price / yChunk) + height - padding
  return { x, y, price }
}

export function pointAtX(x: number, geo: ChartGeometry): number {
  const { width, padding } = geo
  const range = width - padding * 2
  let pt = Math.round((x / range) * PREMIUM_RESOLUTION)
  if (x < 0) pt = 0
  else if (x > range) pt = PREMIUM_RESOLUTION
  return pt
}

export function buildCurvePath(geo: ChartGeometry, step = 500): string {
  let d = `M ${geo.padding} ${geo.padding}`
  for (let i = 0; i < PREMIUM_RESOLUTION; i += step) {
    const { x, y } = posAtPoint(i, geo)
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  const last = posAtPoint(PREMIUM_RESOLUTION, geo)
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return d
}

export function localSlope(point: number, geo: ChartGeometry): number {
  const step = Math.max(50, Math.floor(PREMIUM_RES_PER_DAY / 4))
  const before = posAtPoint(Math.max(0, point - step), geo)
  const after = posAtPoint(Math.min(PREMIUM_RESOLUTION, point + step), geo)
  const dx = after.x - before.x
  const dy = after.y - before.y
  if (dx === 0) return Infinity
  return Math.abs(dy / dx)
}

export function buildSteepZonePath(
  geo: ChartGeometry,
  steepThreshold: number,
  step = 200,
): string {
  const segments: string[] = []
  let current: string | null = null
  for (let i = 0; i <= PREMIUM_RESOLUTION; i += step) {
    const slope = localSlope(i, geo)
    const { x, y } = posAtPoint(i, geo)
    if (slope > steepThreshold) {
      current =
        current === null
          ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
          : `${current} L ${x.toFixed(2)} ${y.toFixed(2)}`
    } else if (current !== null) {
      segments.push(current)
      current = null
    }
  }
  if (current !== null) segments.push(current)
  return segments.join(' ')
}

export type LeaderAxis = 'horizontal' | 'vertical'
export type LeaderDir = 'right' | 'left' | 'up' | 'down'

export type LeaderPlacement = {
  axis: LeaderAxis
  dir: LeaderDir
  slope: number
  isSteep: boolean
}

export type LeaderConfig = {
  steepThreshold: number
  leaderLength: number
  labelWidth: number
  labelHeight: number
  labelGap: number
  padding: number
}

export function chooseLeaderDirection(
  point: number,
  pos: PointPosition,
  geo: ChartGeometry,
  cfg: LeaderConfig,
  forceAxis?: LeaderAxis,
): LeaderPlacement {
  const slope = localSlope(point, geo)
  const isSteep = slope > cfg.steepThreshold

  const horizontalRoom =
    cfg.leaderLength + cfg.labelWidth + cfg.labelGap + cfg.padding
  const verticalRoom =
    cfg.leaderLength + cfg.labelHeight + cfg.labelGap + cfg.padding

  const axis: LeaderAxis = forceAxis ?? (isSteep ? 'horizontal' : 'vertical')

  if (axis === 'horizontal') {
    const spaceRight = geo.width - pos.x
    const spaceLeft = pos.x
    const wantRight = spaceRight >= horizontalRoom
    const wantLeft = spaceLeft >= horizontalRoom
    const dir: LeaderDir = wantRight ? 'right' : wantLeft ? 'left' : 'right'
    return { axis: 'horizontal', dir, slope, isSteep }
  }

  const spaceUp = pos.y
  const spaceDown = geo.height - pos.y
  const wantUp = spaceUp >= verticalRoom
  const wantDown = spaceDown >= verticalRoom
  const dir: LeaderDir = wantUp ? 'up' : wantDown ? 'down' : 'up'
  return { axis: 'vertical', dir, slope, isSteep }
}

export type LeaderGeometry = {
  leaderStart: { x: number; y: number }
  leaderEnd: { x: number; y: number }
  labelAnchor: { x: number; y: number }
  labelTransform: string
  labelTextAlign: 'left' | 'right' | 'center'
}

export function computeLeaderGeometry(
  pos: PointPosition,
  placement: LeaderPlacement,
  cfg: LeaderConfig,
  leaderLengthOverride?: number,
  dotGap = 7,
): LeaderGeometry {
  const len = leaderLengthOverride ?? cfg.leaderLength
  if (placement.axis === 'horizontal') {
    const sign = placement.dir === 'right' ? 1 : -1
    const leaderStart = { x: pos.x + sign * dotGap, y: pos.y }
    const labelAnchor = {
      x: pos.x + sign * (len + cfg.labelGap),
      y: pos.y,
    }
    const leaderEnd = labelAnchor
    return {
      leaderStart,
      leaderEnd,
      labelAnchor,
      labelTransform:
        placement.dir === 'right'
          ? 'translateY(-50%)'
          : 'translate(-100%, -50%)',
      labelTextAlign: placement.dir === 'right' ? 'left' : 'right',
    }
  }

  const sign = placement.dir === 'up' ? -1 : 1
  const leaderStart = { x: pos.x, y: pos.y + sign * dotGap }
  const labelAnchor = {
    x: pos.x,
    y: pos.y + sign * (len + cfg.labelGap),
  }
  const leaderEnd = labelAnchor
  return {
    leaderStart,
    leaderEnd,
    labelAnchor,
    labelTransform:
      placement.dir === 'up' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    labelTextAlign: 'center',
  }
}

export type LabelBox = {
  left: number
  top: number
  right: number
  bottom: number
}

export function labelBox(
  anchor: { x: number; y: number },
  transform: string,
  width: number,
  height: number,
): LabelBox {
  let left = anchor.x
  let top = anchor.y
  if (transform.includes('translate(-100%')) left -= width
  else if (transform.includes('translate(-50%')) left -= width / 2
  if (transform.includes('-100%)')) top -= height
  else if (transform.includes('-50%)')) top -= height / 2
  return { left, top, right: left + width, bottom: top + height }
}

export function labelsCollide(
  anchorA: { x: number; y: number },
  transformA: string,
  anchorB: { x: number; y: number },
  transformB: string,
  width: number,
  height: number,
): boolean {
  const a = labelBox(anchorA, transformA, width, height)
  const b = labelBox(anchorB, transformB, width, height)
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}

export function findHorizontalLeaderClearance(
  pos: PointPosition,
  placement: LeaderPlacement,
  cfg: LeaderConfig,
  obstacleBox: LabelBox,
  geo: ChartGeometry,
  maxExtra = 200,
  step = 10,
): number | null {
  if (placement.axis !== 'horizontal') return null
  const sign = placement.dir === 'right' ? 1 : -1
  for (let extra = 0; extra <= maxExtra; extra += step) {
    const len = cfg.leaderLength + extra
    const labelAnchorX = pos.x + sign * len + sign * cfg.labelGap
    const labelLeft = sign === 1 ? labelAnchorX : labelAnchorX - cfg.labelWidth
    const labelRight = labelLeft + cfg.labelWidth
    if (labelLeft < cfg.padding) return null
    if (labelRight > geo.width - cfg.padding) return null
    const myBox: LabelBox = {
      left: labelLeft,
      top: pos.y - cfg.labelHeight / 2,
      right: labelRight,
      bottom: pos.y + cfg.labelHeight / 2,
    }
    const clears =
      myBox.right < obstacleBox.left ||
      myBox.left > obstacleBox.right ||
      myBox.bottom < obstacleBox.top ||
      myBox.top > obstacleBox.bottom
    if (clears) return len
  }
  return null
}

export function dateToInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function formatMoney(n: number): string {
  // Millions are abbreviated with at most one decimal and no trailing ".0"
  // ($100M, $26.5M, $26M) — matching the clean axis labels rather than the
  // noisy "$26.01M".
  if (n >= 1_000_000) {
    const millions = (n / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `$${millions}M`
  }
  // Pricing page rounds to whole dollars — cents are noise on the big cooldown
  // numbers. Only show cents once the value drops below $1 (the additional fee
  // near the end of its decay).
  if (n >= 1) return `$${Math.round(n).toLocaleString()}`
  // Sub-dollar values show cents, except an exact/rounded $0 which reads as
  // "$0" rather than "$0.00" (e.g. at the end of the cooldown).
  const cents = Math.max(n, 0).toFixed(2)
  return cents === '0.00' ? '$0' : `$${cents}`
}

export function formatChartDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  })
}

export function formatHoverDate(d: Date): string {
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h12',
  })
}

export const UNIT_CHART_GEO: ChartGeometry = { width: 1, height: 1, padding: 0 }
