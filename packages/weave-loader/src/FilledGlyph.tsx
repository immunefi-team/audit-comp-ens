import type { CSSProperties } from 'react'

export interface FilledGlyphProps {
  char: string
  advanceWidth: number
  glyphHeight: number
  fraction: number
  fill: string
  baseColor: string
  animate?: boolean
  gradient?: boolean
}

export function FilledGlyph({
  char,
  advanceWidth,
  glyphHeight,
  fraction,
  fill,
  baseColor,
  animate = true,
  gradient = false,
}: FilledGlyphProps) {
  const insetRight = (1 - fraction) * 100
  const boxHeight = glyphHeight > 0 ? glyphHeight : undefined

  const fillStyle: CSSProperties = gradient
    ? {
        background: fill,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      }
    : { color: fill }

  if (!boxHeight) {
    return (
      <span
        aria-hidden
        className="relative inline-block overflow-visible align-bottom"
        style={{ width: advanceWidth, verticalAlign: 'bottom' }}
      >
        <span style={{ color: baseColor }}>{char}</span>
        {fraction > 0 ? (
          <span
            className="pointer-events-none absolute inset-0 overflow-visible"
            style={{
              clipPath: `inset(0 ${insetRight}% 0 0)`,
              WebkitClipPath: `inset(0 ${insetRight}% 0 0)`,
              transition: animate ? 'clip-path 0.45s ease' : 'none',
            }}
          >
            <span
              style={{
                ...fillStyle,
                display: 'inline-block',
                width: advanceWidth,
              }}
            >
              {char}
            </span>
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className="relative inline-block overflow-visible align-bottom"
      style={{
        width: advanceWidth,
        height: boxHeight,
        verticalAlign: 'bottom',
      }}
    >
      <span
        className="absolute bottom-0 left-0"
        style={{ width: advanceWidth, color: baseColor }}
      >
        {char}
      </span>
      {fraction > 0 ? (
        <span
          className="pointer-events-none absolute bottom-0 left-0 overflow-visible"
          style={{
            width: advanceWidth,
            clipPath: `inset(0 ${insetRight}% 0 0)`,
            WebkitClipPath: `inset(0 ${insetRight}% 0 0)`,
            transition: animate ? 'clip-path 0.45s ease' : 'none',
          }}
        >
          <span
            style={{
              ...fillStyle,
              display: 'inline-block',
              width: advanceWidth,
            }}
          >
            {char}
          </span>
        </span>
      ) : null}
    </span>
  )
}
