export const FALLBACK_FONT =
  'Satoshi, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export interface TextMetricsBox {
  width: number
  height: number
  baseline: number
}

/** Escape text content and attribute values destined for inline SVG markup. */
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * Coerce a value that must end up as a numeric SVG attribute. Anything
 * non-finite (NaN, Infinity, injected strings) collapses to 0 so it can never
 * break out of the attribute or inject markup.
 */
function safeNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export interface NameSvgOptions {
  name: string
  box: TextMetricsBox
  fontSize: number
  fontFamily: string
  fontWeight: number | string
  fill: string
}

export function nameSvgDataUri({
  name,
  box,
  fontSize,
  fontFamily,
  fontWeight,
  fill,
}: NameSvgOptions): string {
  const width = safeNumber(box.width)
  const height = safeNumber(box.height)
  const baseline = safeNumber(box.baseline)
  const safeFontSize = safeNumber(fontSize)
  // font-weight is a keyword (`bold`) or a number; escape the keyword form.
  const safeFontWeight =
    typeof fontWeight === 'number'
      ? safeNumber(fontWeight)
      : escapeXml(fontWeight)
  const safeFontFamily = escapeXml(fontFamily)
  const safeFill = escapeXml(fill)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="0" y="${baseline}" font-family="${safeFontFamily}" ` +
    `font-size="${safeFontSize}" font-weight="${safeFontWeight}" fill="${safeFill}" ` +
    `xml:space="preserve">${escapeXml(name)}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function measureName(
  name: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
): TextMetricsBox {
  if (typeof document === 'undefined') {
    return {
      width: name.length * fontSize * 0.55,
      height: fontSize * 1.3,
      baseline: fontSize,
    }
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      width: name.length * fontSize * 0.55,
      height: fontSize * 1.3,
      baseline: fontSize,
    }
  }
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const m = ctx.measureText(name)
  const ascent = m.actualBoundingBoxAscent || fontSize * 0.8
  const descent = m.actualBoundingBoxDescent || fontSize * 0.25
  const pad = Math.ceil(fontSize * 0.12)
  return {
    width: Math.ceil(m.width) + pad * 2,
    height: Math.ceil(ascent + descent) + pad * 2,
    baseline: Math.ceil(ascent) + pad,
  }
}
