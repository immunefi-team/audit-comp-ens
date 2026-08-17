import { memo, useEffect } from 'react'
import { cn } from './lib/utils'
import fragmentSource from './shader/fragment.prod.glsl?raw'
import {
  useWeaveShader,
  type WeaveShaderOptions,
} from './shader/useWeaveShader'
import vertexSource from './shader/vertex.glsl?raw'

export interface WeaveCanvasProps {
  options?: WeaveShaderOptions
  className?: string
}

/**
 * Static, dependency-free stand-in shown when WebGL is unavailable or the shader
 * fails to compile (disabled WebGL, GPU blocklist, privacy modes, old mobile
 * browsers, transient context loss). A boring brand-tinted gradient — never the
 * shader error log — so the registration flow degrades gracefully.
 */
export function WeaveFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('absolute inset-0', className)}
      style={{
        backgroundImage:
          'linear-gradient(135deg, #e9f2f8 0%, #9fcbe4 45%, #cfe6f3 70%, #e9f2f8 100%)',
      }}
    />
  )
}

function WeaveCanvasInner({ options, className }: WeaveCanvasProps) {
  const { canvasRef, containerRef, error } = useWeaveShader(
    vertexSource,
    fragmentSource,
    options,
  )

  useEffect(() => {
    if (error && import.meta.env.DEV) {
      console.error('[WeaveCanvas] WebGL/shader error:', error)
    }
  }, [error])

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      ref={containerRef}
    >
      <canvas
        className={cn('block h-full w-full', error && 'invisible')}
        ref={canvasRef}
      />
      {error ? <WeaveFallback /> : null}
    </div>
  )
}

export const WeaveCanvas = memo(WeaveCanvasInner)
