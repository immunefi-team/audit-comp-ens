import { useLayoutEffect, useState } from 'react'
import { cn } from './lib/utils'
import {
  FALLBACK_FONT,
  measureName,
  nameSvgDataUri,
  type TextMetricsBox,
} from './nameMask'
import type { WeaveShaderOptions } from './shader/useWeaveShader'
import { WeaveCanvas } from './WeaveCanvas'

export interface WeaveNameProps {
  name: string
  progress?: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: number | string
  baseColor?: string
  animate?: boolean
  weaveOptions?: WeaveShaderOptions
  className?: string
}

export function WeaveName({
  name,
  progress = 1,
  fontSize = 64,
  fontFamily = FALLBACK_FONT,
  fontWeight = 700,
  baseColor = 'rgba(0,0,0,0.12)',
  animate = true,
  weaveOptions,
  className,
}: WeaveNameProps) {
  const [box, setBox] = useState<TextMetricsBox>({
    width: 0,
    height: 0,
    baseline: 0,
  })

  useLayoutEffect(() => {
    setBox(measureName(name, fontSize, fontFamily, fontWeight))
  }, [name, fontSize, fontFamily, fontWeight])

  const p = Math.max(0, Math.min(1, progress))
  const { width, height } = box

  const baseUri =
    width > 0
      ? nameSvgDataUri({
          name,
          box,
          fontSize,
          fontFamily,
          fontWeight,
          fill: '#000',
        })
      : ''
  const glyphMaskUri =
    width > 0
      ? nameSvgDataUri({
          name,
          box,
          fontSize,
          fontFamily,
          fontWeight,
          fill: '#fff',
        })
      : ''

  const insetRight = (1 - p) * 100

  return (
    <span
      className={cn('relative inline-block align-bottom', className)}
      style={{ width: width || undefined, height: height || undefined }}
    >
      <span className="sr-only">{name}</span>

      {baseUri ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundColor: baseColor,
            WebkitMaskImage: baseUri,
            maskImage: baseUri,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
          }}
        />
      ) : null}

      {glyphMaskUri ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            WebkitMaskImage: glyphMaskUri,
            maskImage: glyphMaskUri,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            clipPath: `inset(0 ${insetRight}% 0 0)`,
            transition: animate ? 'clip-path 0.45s ease' : 'none',
          }}
        >
          <WeaveCanvas
            className="h-full w-full"
            options={{ ...weaveOptions, animated: animate }}
          />
        </span>
      ) : null}
    </span>
  )
}
