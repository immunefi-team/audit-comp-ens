import { memo, useEffect } from 'react'
import { cn } from './lib/utils'
import fragmentSource from './shader/fragment.glsl?raw'
import {
  useWeaveShader,
  type WeaveShaderOptions,
} from './shader/useWeaveShader'
import vertexSource from './shader/vertex.glsl?raw'
import { WeaveFallback } from './WeaveCanvas'

export interface WeaveCanvasSandboxProps {
  options?: WeaveShaderOptions
  className?: string
}

/** Storybook-only — full sandbox shader; production uses {@link WeaveCanvas}. */
function WeaveCanvasSandboxInner({
  options,
  className,
}: WeaveCanvasSandboxProps) {
  const { canvasRef, containerRef, error } = useWeaveShader(
    vertexSource,
    fragmentSource,
    options,
  )

  useEffect(() => {
    if (error && import.meta.env.DEV) {
      console.error('[WeaveCanvasSandbox] WebGL/shader error:', error)
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

export const WeaveCanvasSandbox = memo(WeaveCanvasSandboxInner)
