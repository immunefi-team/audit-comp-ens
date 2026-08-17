export type GlyphMetrics = {
  advanceWidth: number
  glyphHeight: number
  lineIndex: number
}

/**
 * Split a string into grapheme clusters so emoji, astral characters, and
 * combining marks count as one visual unit. Falls back to code points
 * (`Array.from`) where `Intl.Segmenter` is unavailable. Measurement and
 * rendering MUST use the same segmentation, otherwise glyph counts diverge.
 */
export function segmentGraphemes(value: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    })
    return Array.from(segmenter.segment(value), (s) => s.segment)
  }
  return Array.from(value)
}

export function charFillFraction(fillPosition: number, index: number): number {
  return Math.max(0, Math.min(1, fillPosition - index))
}

export type LineGroup = {
  lineIndex: number
  startCharIndex: number
  charCount: number
  text: string
}

/** Group measured glyphs into wrapped lines for line-based fill reveal. */
export function groupCharsByLine(
  chars: string[],
  metrics: GlyphMetrics[],
): LineGroup[] {
  if (metrics.length === 0) return []

  const lines: LineGroup[] = []
  let lineStart = 0
  let currentLine = metrics[0]?.lineIndex ?? 0

  for (let index = 1; index <= metrics.length; index += 1) {
    const nextLine = index < metrics.length ? metrics[index]?.lineIndex : -1
    if (index === metrics.length || nextLine !== currentLine) {
      lines.push({
        lineIndex: currentLine,
        startCharIndex: lineStart,
        charCount: index - lineStart,
        text: chars.slice(lineStart, index).join(''),
      })
      lineStart = index
      if (index < metrics.length && nextLine !== undefined) {
        currentLine = nextLine
      }
    }
  }

  return lines
}

/**
 * 0–1 horizontal reveal for one line. Uses measured advance widths so partial
 * characters fill proportionally without per-glyph clip-path cells.
 */
export function lineRevealRatio(
  lineStart: number,
  lineMetrics: GlyphMetrics[],
  fillPosition: number,
): number {
  const count = lineMetrics.length
  if (count === 0) return 0
  if (fillPosition <= lineStart) return 0
  if (fillPosition >= lineStart + count) return 1

  let filledWidth = 0
  let totalWidth = 0
  for (let index = 0; index < count; index += 1) {
    const width = lineMetrics[index]?.advanceWidth ?? 0
    totalWidth += width
    filledWidth += width * charFillFraction(fillPosition, lineStart + index)
  }

  return totalWidth > 0 ? Math.min(1, filledWidth / totalWidth) : 0
}

function groupLineIndices(midYs: number[]): number[] {
  if (midYs.length === 0) return []

  const firstMidY = midYs[0]
  if (firstMidY === undefined) return []

  const lineIndices: number[] = [0]
  let lineIndex = 0
  let lineMidY = firstMidY

  for (let index = 1; index < midYs.length; index += 1) {
    const midY = midYs[index]
    const prevMidY = midYs[index - 1]
    if (prevMidY === undefined || midY === undefined) continue

    const threshold = Math.max(1, Math.abs(midY - prevMidY) * 0.35)
    if (Math.abs(midY - lineMidY) > threshold) {
      lineIndex += 1
      lineMidY = midY
    }
    lineIndices.push(lineIndex)
  }

  return lineIndices
}

export function measureGlyphMetrics(
  probe: HTMLElement,
  textNode: Text,
  segments: string[],
): GlyphMetrics[] {
  const probeBox = probe.getBoundingClientRect()
  const range = document.createRange()
  const positions: {
    x: number
    width: number
    height: number
    midY: number
  }[] = []

  // Walk grapheme clusters, advancing by each cluster's UTF-16 length so the
  // range offsets stay aligned with the text node's code units.
  let offset = 0
  for (const segment of segments) {
    const start = offset
    const end = offset + segment.length
    offset = end
    range.setStart(textNode, start)
    range.setEnd(textNode, end)
    const box = range.getBoundingClientRect()
    positions.push({
      x: box.left - probeBox.left,
      width: Math.max(box.width, 0),
      height: Math.max(box.height, 0),
      midY: box.top + box.height / 2,
    })
  }

  if (positions.length === 0) return []

  const lineIndices = groupLineIndices(
    positions.map((position) => position.midY),
  )

  return positions.map((position, index) => {
    const next = positions[index + 1]
    const sameLine =
      next !== undefined && lineIndices[index] === lineIndices[index + 1]
    const advanceWidth = sameLine
      ? Math.max(next.x - position.x, position.width)
      : position.width

    return {
      advanceWidth,
      glyphHeight: position.height,
      lineIndex: lineIndices[index] ?? 0,
    }
  })
}

export function lineCountFromMetrics(metrics: GlyphMetrics[]): number {
  if (metrics.length === 0) return 1
  return Math.max(...metrics.map((metric) => metric.lineIndex)) + 1
}
