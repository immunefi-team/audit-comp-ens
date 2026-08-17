import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COLORWAY_BIAS_ANIM,
  randomColorwayLoopValues,
  resolveAnimatedColorwayBias,
  resolveAnimatedColorwayNoiseX,
  tickColorwayLoopCycle,
} from '../colorwayAnim'
import { buildPatternTexture, PATTERNS, type WeavePattern } from './patterns'
import {
  getPaletteColor,
  WEAVE_DEFAULTS,
  type WeaveGradient,
} from './weaveConfig'

const DPR = 2

export interface WeaveShaderOptions {
  pattern?: number
  palette?: number
  bgShade?: number
  warpShade?: number
  weftShade?: number
  gridSize?: number
  warpGradient?: WeaveGradient
  weftGradient?: WeaveGradient
  warpGradientEnabled?: boolean
  weftGradientEnabled?: boolean
  gradSteps?: number
  rectAspect?: number
  cornerRadius?: number
  shimmer?: boolean
  shimmerSpeed?: number
  shimmerWidth?: number
  shimmerIntensity?: number
  shimmerPosition?: number
  shimmerRotation?: number
  shimmerNoise?: number
  shimmerNoiseSeed?: number
  shimmerNoiseMin?: number
  shimmerNoiseMax?: number
  shimmerBlendMode?: number
  useAllColorways?: boolean
  colorwaySeed?: number
  colorwayNoiseScale?: number
  colorwayNoiseMode?: number
  colorwayNoiseOctaves?: number
  colorwayNoisePersistence?: number
  colorwayNoiseLacunarity?: number
  colorwayNoiseBias?: number
  colorwayNoiseX?: number
  colorwayBleedAnisotropy?: number
  colorwayBleedRotation?: number
  colorwayBleedCrossFiber?: number
  colorwayBleedDraftCoupled?: boolean
  colorwayIncludeMask?: number
  /** Jacquard-style bias play loop (44s, 0.25–4 around colorwayNoiseBias). */
  animateColorwayBias?: boolean
  /** Jacquard-style noise X play loop (~50min, -500–500 around colorwayNoiseX). */
  animateColorwayNoiseX?: boolean
  /** Skip the diagonal weave-in on mount; fabric starts fully revealed. */
  skipWeaveInReveal?: boolean
  /** Restart colorway play loops each cycle (bias period = 44s). */
  colorwayAnimLoop?: boolean
  /** Pick new seed / scale / bleed / anim origins when a loop cycle wraps. */
  colorwayAnimRandomizeOnLoop?: boolean
  patterns?: WeavePattern[]
  onFpsChange?: (fps: number) => void
  /**
   * Drive a continuous requestAnimationFrame loop. Default `true`.
   * When `false`, the canvas renders a single frame on mount and again only
   * after a resize or option change — no per-frame rAF. Use for static weaves
   * (no shimmer / colorway animation) and for reduced-motion.
   */
  animated?: boolean
}

type UniformLocs = ReturnType<typeof getUniformLocs>

function getUniformLocs(gl: WebGLRenderingContext, program: WebGLProgram) {
  const u = (name: string) => gl.getUniformLocation(program, name)
  return {
    time: u('u_time'),
    resolution: u('u_resolution'),
    patternSampler: u('u_patternSampler'),
    ensMarkVisible: u('u_ensMarkVisible'),
    patternIndex: u('u_patternIndex'),
    tileW: u('u_tileW'),
    tileH: u('u_tileH'),
    patternTexHeight: u('u_patternTexHeight'),
    palette: u('u_palette'),
    bgShade: u('u_bgShade'),
    warpShade: u('u_warpShade'),
    weftShade: u('u_weftShade'),
    gridSize: u('u_gridSize'),
    warpStart: u('u_warpStart'),
    warpEnd: u('u_warpEnd'),
    weftStart: u('u_weftStart'),
    weftEnd: u('u_weftEnd'),
    warpDir: u('u_warpDir'),
    weftDir: u('u_weftDir'),
    warpStartPos: u('u_warpStartPos'),
    warpEndPos: u('u_warpEndPos'),
    weftStartPos: u('u_weftStartPos'),
    weftEndPos: u('u_weftEndPos'),
    gradSteps: u('u_gradSteps'),
    revealStartTime: u('u_revealStartTime'),
    rectAspect: u('u_rectAspect'),
    cornerRadius: u('u_cornerRadius'),
    shimmer: u('u_shimmer'),
    shimmerSpeed: u('u_shimmerSpeed'),
    shimmerTime: u('u_shimmerTime'),
    shimmerWidth: u('u_shimmerWidth'),
    shimmerIntensity: u('u_shimmerIntensity'),
    shimmerPosition: u('u_shimmerPosition'),
    shimmerRotation: u('u_shimmerRotation'),
    shimmerNoise: u('u_shimmerNoise'),
    shimmerNoiseSeed: u('u_shimmerNoiseSeed'),
    shimmerNoiseMin: u('u_shimmerNoiseMin'),
    shimmerNoiseMax: u('u_shimmerNoiseMax'),
    shimmerBlendMode: u('u_shimmerBlendMode'),
    useAllColorways: u('u_useAllColorways'),
    colorwaySeed: u('u_colorwaySeed'),
    colorwayNoiseScale: u('u_colorwayNoiseScale'),
    colorwayNoiseMode: u('u_colorwayNoiseMode'),
    colorwayNoiseOctaves: u('u_colorwayNoiseOctaves'),
    colorwayNoisePersistence: u('u_colorwayNoisePersistence'),
    colorwayNoiseLacunarity: u('u_colorwayNoiseLacunarity'),
    colorwayNoiseBias: u('u_colorwayNoiseBias'),
    colorwayNoiseX: u('u_colorwayNoiseX'),
    colorwayBleedAnisotropy: u('u_colorwayBleedAnisotropy'),
    colorwayBleedRotation: u('u_colorwayBleedRotation'),
    colorwayBleedCrossFiber: u('u_colorwayBleedCrossFiber'),
    colorwayBleedDraftCoupled: u('u_colorwayBleedDraftCoupled'),
    colorwayInclude0123: u('u_colorwayInclude0123'),
    colorwayInclude4: u('u_colorwayInclude4'),
    stitchRevealMode: u('u_stitchRevealMode'),
    stitchRevealProgress: u('u_stitchRevealProgress'),
    stitchRevealSeed: u('u_stitchRevealSeed'),
    stitchRevealScale: u('u_stitchRevealScale'),
    stitchRevealNoiseScale: u('u_stitchRevealNoiseScale'),
    stitchRevealSoftness: u('u_stitchRevealSoftness'),
    stitchRevealBleedAnisotropy: u('u_stitchRevealBleedAnisotropy'),
    stitchRevealBleedRotation: u('u_stitchRevealBleedRotation'),
    stitchRevealBleedCrossFiber: u('u_stitchRevealBleedCrossFiber'),
    stitchRevealBleedDraftCoupled: u('u_stitchRevealBleedDraftCoupled'),
    stageTranslateX: u('u_stageTranslateX'),
    hoverReactive: u('u_hoverReactive'),
    hoverRevealOnly: u('u_hoverRevealOnly'),
    hoverMovementBoost: u('u_hoverMovementBoost'),
    pointerUv: u('u_pointerUv'),
    hoverStrength: u('u_hoverStrength'),
    hoverVelocity: u('u_hoverVelocity'),
    ripplePhase: u('u_ripplePhase'),
    rippleWidth: u('u_rippleWidth'),
  }
}

const QUAD_POSITIONS = new Float32Array([
  -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
])

function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error:\n${log}`)
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileShader(gl, vertexSource, gl.VERTEX_SHADER)
  const fs = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error:\n${log}`)
  }
  return program
}

export interface WeaveShaderResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  error: string
  fps: number
}

export function useWeaveShader(
  vertexSource: string,
  fragmentSource: string,
  options: WeaveShaderOptions = {},
): WeaveShaderResult {
  const o = { ...WEAVE_DEFAULTS, ...options } as typeof WEAVE_DEFAULTS &
    WeaveShaderOptions

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')
  const [fps, setFps] = useState(0)

  const optsRef = useRef(o)
  optsRef.current = o

  const colorwayBiasAnimRef = useRef({
    enabled: false,
    origin: WEAVE_DEFAULTS.colorwayNoiseBias,
    startMs: Date.now(),
  })
  const colorwayNoiseXAnimRef = useRef({
    enabled: false,
    origin: WEAVE_DEFAULTS.colorwayNoiseX,
    startMs: Date.now(),
  })
  const colorwayLoopStartRef = useRef(Date.now())
  const colorwayRuntimeRef = useRef({
    seed: options.colorwaySeed ?? WEAVE_DEFAULTS.colorwaySeed,
    noiseScale: options.colorwayNoiseScale ?? WEAVE_DEFAULTS.colorwayNoiseScale,
    bleedAnisotropy:
      options.colorwayBleedAnisotropy ?? WEAVE_DEFAULTS.colorwayBleedAnisotropy,
  })

  const allColorwaysEnabled = options.useAllColorways !== false
  const biasAnimEnabled =
    allColorwaysEnabled && options.animateColorwayBias === true
  if (biasAnimEnabled && !colorwayBiasAnimRef.current.enabled) {
    colorwayBiasAnimRef.current = {
      enabled: true,
      origin: options.colorwayNoiseBias ?? WEAVE_DEFAULTS.colorwayNoiseBias,
      startMs: Date.now(),
    }
  } else if (!biasAnimEnabled) {
    colorwayBiasAnimRef.current.enabled = false
  }

  const noiseXAnimEnabled =
    allColorwaysEnabled && options.animateColorwayNoiseX === true
  if (noiseXAnimEnabled && !colorwayNoiseXAnimRef.current.enabled) {
    colorwayNoiseXAnimRef.current = {
      enabled: true,
      origin: options.colorwayNoiseX ?? WEAVE_DEFAULTS.colorwayNoiseX,
      startMs: Date.now(),
    }
  } else if (!noiseXAnimEnabled) {
    colorwayNoiseXAnimRef.current.enabled = false
  }

  const onFpsChangeRef = useRef(options.onFpsChange)
  onFpsChangeRef.current = options.onFpsChange
  const patterns = options.patterns ?? PATTERNS

  // Render-loop control. `ensureLoopRef` either keeps/starts the rAF loop (when
  // animation is wanted and the canvas is visible + on-screen) or draws a single
  // frame to reflect the latest options when static.
  const ensureLoopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    onFpsChangeRef.current?.(fps)
  }, [fps])

  const run = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return undefined

    const contextAttrs: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    }
    const gl =
      (canvas.getContext(
        'webgl',
        contextAttrs,
      ) as WebGLRenderingContext | null) ||
      (canvas.getContext(
        'experimental-webgl',
        contextAttrs,
      ) as WebGLRenderingContext | null)
    if (!gl) {
      setError('WebGL is not supported')
      return undefined
    }
    setError('')

    let program: WebGLProgram | null = null
    let positionBuffer: WebGLBuffer | null = null
    let patternTexture: WebGLTexture | null = null
    let animationId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let pageVisible =
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
    let inView = true
    const startTime = Date.now()
    let lastFrameTime = Date.now()
    let frameCount = 0
    let uniformLocs: UniformLocs | null = null
    let patternTexHeight = 0
    let lastPatternIndex = -1
    let revealStartTime = 0
    const list = Array.isArray(patterns) ? patterns : PATTERNS

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = rect.width * DPR
      const h = rect.height * DPR
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      gl.viewport(0, 0, w, h)
      // When static (no rAF loop), redraw immediately to fill the new size.
      if (animationId == null) render(false)
    }

    const setupGeometry = () => {
      positionBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW)
    }

    const render = (countFrame = false) => {
      if (!program || !uniformLocs) return
      const s = optsRef.current
      const animatedNow = s.animated !== false
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API, not a React hook.
      gl.useProgram(program)
      const time = (Date.now() - startTime) / 1000

      const pi = Math.floor(s.pattern)
      if (
        lastPatternIndex !== -1 &&
        pi !== lastPatternIndex &&
        !s.skipWeaveInReveal
      ) {
        revealStartTime = time
      }
      lastPatternIndex = pi
      const pat = list[Math.min(Math.max(0, pi), list.length - 1)] ?? list[0]
      const tileW = pat?.tileW ?? 8
      const tileH = pat?.tileH ?? 8

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, patternTexture)
      gl.uniform1i(uniformLocs.patternSampler, 0)
      if (uniformLocs.ensMarkVisible)
        gl.uniform1f(uniformLocs.ensMarkVisible, 0)

      gl.uniform1f(uniformLocs.time, time)
      if (uniformLocs.shimmerTime) gl.uniform1f(uniformLocs.shimmerTime, time)
      gl.uniform2f(uniformLocs.resolution, canvas.width, canvas.height)
      if (uniformLocs.stageTranslateX)
        gl.uniform1f(uniformLocs.stageTranslateX, 0)
      gl.uniform1f(uniformLocs.patternIndex, pi)
      gl.uniform1f(uniformLocs.tileW, tileW)
      gl.uniform1f(uniformLocs.tileH, tileH)
      gl.uniform1f(uniformLocs.patternTexHeight, patternTexHeight)
      gl.uniform1f(uniformLocs.palette, s.palette)
      gl.uniform1f(uniformLocs.bgShade, s.bgShade)
      gl.uniform1f(uniformLocs.warpShade, s.warpShade)
      gl.uniform1f(uniformLocs.weftShade, s.weftShade)
      gl.uniform1f(uniformLocs.gridSize, s.gridSize)

      const ws = s.warpShade
      const wes = s.weftShade
      let wg: WeaveGradient = s.warpGradient || {
        startShade: ws,
        endShade: ws,
        direction: 0,
        range: [0, 100],
      }
      let wf: WeaveGradient = s.weftGradient || {
        startShade: wes,
        endShade: wes,
        direction: 0,
        range: [0, 100],
      }
      if (!s.warpGradientEnabled) wg = { ...wg, startShade: ws, endShade: ws }
      if (!s.weftGradientEnabled) wf = { ...wf, startShade: wes, endShade: wes }
      const warpStart = getPaletteColor(s.palette, wg.startShade)
      const warpEnd = getPaletteColor(s.palette, wg.endShade)
      const weftStart = getPaletteColor(s.palette, wf.startShade)
      const weftEnd = getPaletteColor(s.palette, wf.endShade)
      gl.uniform4f(
        uniformLocs.warpStart,
        warpStart[0],
        warpStart[1],
        warpStart[2],
        warpStart[3],
      )
      gl.uniform4f(
        uniformLocs.warpEnd,
        warpEnd[0],
        warpEnd[1],
        warpEnd[2],
        warpEnd[3],
      )
      gl.uniform4f(
        uniformLocs.weftStart,
        weftStart[0],
        weftStart[1],
        weftStart[2],
        weftStart[3],
      )
      gl.uniform4f(
        uniformLocs.weftEnd,
        weftEnd[0],
        weftEnd[1],
        weftEnd[2],
        weftEnd[3],
      )
      gl.uniform1f(uniformLocs.warpDir, wg.direction || 0)
      gl.uniform1f(uniformLocs.weftDir, wf.direction || 0)
      const wr = wg.range
      const wfr = wf.range
      gl.uniform1f(uniformLocs.warpStartPos, Math.min(wr[0], wr[1]) / 100)
      gl.uniform1f(uniformLocs.warpEndPos, Math.max(wr[0], wr[1]) / 100)
      gl.uniform1f(uniformLocs.weftStartPos, Math.min(wfr[0], wfr[1]) / 100)
      gl.uniform1f(uniformLocs.weftEndPos, Math.max(wfr[0], wfr[1]) / 100)
      gl.uniform1f(uniformLocs.gradSteps, s.gradSteps)
      gl.uniform1f(
        uniformLocs.revealStartTime,
        s.skipWeaveInReveal || !animatedNow ? time - 10_000 : revealStartTime,
      )
      gl.uniform1f(uniformLocs.rectAspect, s.rectAspect)
      gl.uniform1f(uniformLocs.cornerRadius, s.cornerRadius)

      if (uniformLocs.shimmer)
        gl.uniform1f(uniformLocs.shimmer, s.shimmer ? 1 : 0)
      if (uniformLocs.shimmerSpeed)
        gl.uniform1f(uniformLocs.shimmerSpeed, s.shimmerSpeed)
      if (uniformLocs.shimmerWidth)
        gl.uniform1f(uniformLocs.shimmerWidth, s.shimmerWidth)
      if (uniformLocs.shimmerIntensity)
        gl.uniform1f(uniformLocs.shimmerIntensity, s.shimmerIntensity)
      if (uniformLocs.shimmerPosition)
        gl.uniform1f(uniformLocs.shimmerPosition, s.shimmerPosition)
      if (uniformLocs.shimmerRotation)
        gl.uniform1f(uniformLocs.shimmerRotation, s.shimmerRotation)
      if (uniformLocs.shimmerNoise)
        gl.uniform1f(uniformLocs.shimmerNoise, s.shimmerNoise)
      if (uniformLocs.shimmerNoiseSeed)
        gl.uniform1f(uniformLocs.shimmerNoiseSeed, s.shimmerNoiseSeed)
      if (uniformLocs.shimmerNoiseMin)
        gl.uniform1f(uniformLocs.shimmerNoiseMin, s.shimmerNoiseMin)
      if (uniformLocs.shimmerNoiseMax)
        gl.uniform1f(uniformLocs.shimmerNoiseMax, s.shimmerNoiseMax)
      if (uniformLocs.shimmerBlendMode)
        gl.uniform1f(uniformLocs.shimmerBlendMode, s.shimmerBlendMode)

      if (uniformLocs.useAllColorways)
        gl.uniform1f(uniformLocs.useAllColorways, s.useAllColorways ? 1 : 0)

      const colorwayRuntime = colorwayRuntimeRef.current
      const anyColorwayAnim =
        s.useAllColorways &&
        (colorwayBiasAnimRef.current.enabled ||
          colorwayNoiseXAnimRef.current.enabled)

      if (s.colorwayAnimLoop && anyColorwayAnim) {
        const cycle = tickColorwayLoopCycle(
          colorwayLoopStartRef.current,
          COLORWAY_BIAS_ANIM.periodMs,
        )
        colorwayLoopStartRef.current = cycle.startMs
        if (cycle.didWrap) {
          colorwayBiasAnimRef.current.startMs = cycle.startMs
          colorwayNoiseXAnimRef.current.startMs = cycle.startMs
          if (s.colorwayAnimRandomizeOnLoop) {
            const next = randomColorwayLoopValues()
            colorwayRuntime.seed = next.seed
            colorwayRuntime.noiseScale = next.noiseScale
            colorwayRuntime.bleedAnisotropy = next.bleedAnisotropy
            if (colorwayBiasAnimRef.current.enabled) {
              colorwayBiasAnimRef.current.origin = next.biasOrigin
            }
            if (colorwayNoiseXAnimRef.current.enabled) {
              colorwayNoiseXAnimRef.current.origin = next.noiseXOrigin
            }
          }
        }
      }

      if (uniformLocs.colorwaySeed) {
        gl.uniform1f(
          uniformLocs.colorwaySeed,
          s.colorwayAnimRandomizeOnLoop ? colorwayRuntime.seed : s.colorwaySeed,
        )
      }
      if (uniformLocs.colorwayNoiseScale) {
        gl.uniform1f(
          uniformLocs.colorwayNoiseScale,
          s.colorwayAnimRandomizeOnLoop
            ? colorwayRuntime.noiseScale
            : s.colorwayNoiseScale,
        )
      }
      if (uniformLocs.colorwayNoiseMode)
        gl.uniform1f(uniformLocs.colorwayNoiseMode, s.colorwayNoiseMode)
      if (uniformLocs.colorwayNoiseOctaves)
        gl.uniform1f(uniformLocs.colorwayNoiseOctaves, s.colorwayNoiseOctaves)
      if (uniformLocs.colorwayNoisePersistence)
        gl.uniform1f(
          uniformLocs.colorwayNoisePersistence,
          s.colorwayNoisePersistence,
        )
      if (uniformLocs.colorwayNoiseLacunarity)
        gl.uniform1f(
          uniformLocs.colorwayNoiseLacunarity,
          s.colorwayNoiseLacunarity,
        )
      if (uniformLocs.colorwayNoiseBias) {
        const biasAnim = colorwayBiasAnimRef.current
        const bias = resolveAnimatedColorwayBias(
          biasAnim.enabled && s.useAllColorways,
          Date.now() - biasAnim.startMs,
          biasAnim.origin,
        )
        gl.uniform1f(uniformLocs.colorwayNoiseBias, bias)
      }
      if (uniformLocs.colorwayNoiseX) {
        const noiseXAnim = colorwayNoiseXAnimRef.current
        const noiseX = resolveAnimatedColorwayNoiseX(
          noiseXAnim.enabled && s.useAllColorways,
          Date.now() - noiseXAnim.startMs,
          noiseXAnim.origin,
        )
        gl.uniform1f(uniformLocs.colorwayNoiseX, noiseX)
      }
      if (uniformLocs.colorwayBleedAnisotropy)
        gl.uniform1f(
          uniformLocs.colorwayBleedAnisotropy,
          s.colorwayAnimRandomizeOnLoop
            ? colorwayRuntime.bleedAnisotropy
            : s.colorwayBleedAnisotropy,
        )
      if (uniformLocs.colorwayBleedRotation)
        gl.uniform1f(uniformLocs.colorwayBleedRotation, s.colorwayBleedRotation)
      if (uniformLocs.colorwayBleedCrossFiber)
        gl.uniform1f(
          uniformLocs.colorwayBleedCrossFiber,
          s.colorwayBleedCrossFiber,
        )
      if (uniformLocs.colorwayBleedDraftCoupled)
        gl.uniform1f(
          uniformLocs.colorwayBleedDraftCoupled,
          s.colorwayBleedDraftCoupled ? 1 : 0,
        )
      const cm = Math.max(0, Math.min(31, Math.floor(s.colorwayIncludeMask)))
      if (uniformLocs.colorwayInclude0123) {
        gl.uniform4f(
          uniformLocs.colorwayInclude0123,
          cm & 1 ? 1 : 0,
          cm & 2 ? 1 : 0,
          cm & 4 ? 1 : 0,
          cm & 8 ? 1 : 0,
        )
      }
      if (uniformLocs.colorwayInclude4)
        gl.uniform1f(uniformLocs.colorwayInclude4, cm & 16 ? 1 : 0)

      if (uniformLocs.stitchRevealMode)
        gl.uniform1f(uniformLocs.stitchRevealMode, 0)
      if (uniformLocs.stitchRevealProgress)
        gl.uniform1f(uniformLocs.stitchRevealProgress, 1)

      if (uniformLocs.hoverReactive) gl.uniform1f(uniformLocs.hoverReactive, 0)
      if (uniformLocs.hoverRevealOnly)
        gl.uniform1f(uniformLocs.hoverRevealOnly, 0)
      if (uniformLocs.hoverMovementBoost)
        gl.uniform1f(uniformLocs.hoverMovementBoost, 0)
      if (uniformLocs.pointerUv) gl.uniform2f(uniformLocs.pointerUv, 0.5, 0.5)
      if (uniformLocs.hoverStrength) gl.uniform1f(uniformLocs.hoverStrength, 0)
      if (uniformLocs.hoverVelocity) gl.uniform1f(uniformLocs.hoverVelocity, 0)
      if (uniformLocs.ripplePhase) gl.uniform1f(uniformLocs.ripplePhase, 0)
      if (uniformLocs.rippleWidth) gl.uniform1f(uniformLocs.rippleWidth, 0.22)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (!countFrame) return
      frameCount++
      const now = Date.now()
      const elapsed = now - lastFrameTime
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed))
        frameCount = 0
        lastFrameTime = now
      }
    }

    // Animation is wanted only when the consumer opted in AND the canvas is
    // both page-visible and on-screen. Otherwise we stay static (render once).
    const wantsAnimation = () =>
      optsRef.current.animated !== false && pageVisible && inView

    const loop = () => {
      render(true)
      if (wantsAnimation()) {
        animationId = requestAnimationFrame(loop)
      } else {
        animationId = null
      }
    }

    // Keep the loop running when animation is wanted; otherwise draw a single
    // frame so the canvas reflects the latest resize / option changes.
    const ensureLoop = () => {
      if (wantsAnimation()) {
        if (animationId == null) animationId = requestAnimationFrame(loop)
      } else {
        if (animationId != null) {
          cancelAnimationFrame(animationId)
          animationId = null
        }
        render(false)
      }
    }
    ensureLoopRef.current = ensureLoop

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState !== 'hidden'
      ensureLoop()
    }

    try {
      program = createProgram(gl, vertexSource, fragmentSource)
      uniformLocs = getUniformLocs(gl, program)

      const {
        data: texData,
        width: texW,
        height: texH,
      } = buildPatternTexture(list)
      patternTexHeight = texH
      patternTexture = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, patternTexture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        texW,
        texH,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texData,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      setupGeometry()
      const posLoc = gl.getAttribLocation(program, 'a_position')
      gl.enableVertexAttribArray(posLoc)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      resize()
      window.addEventListener('resize', resize)
      resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(container)

      // Pause the loop when the tab is hidden or the canvas scrolls off-screen.
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          inView = entries.some((e) => e.isIntersecting)
          ensureLoop()
        },
        { threshold: 0 },
      )
      intersectionObserver.observe(container)
      document.addEventListener('visibilitychange', onVisibilityChange)

      ensureLoop()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }

    const safeDisconnect = (observer: { disconnect: () => void } | null) => {
      try {
        observer?.disconnect()
      } catch {
        /* noop */
      }
    }

    return () => {
      ensureLoopRef.current = null
      safeDisconnect(resizeObserver)
      safeDisconnect(intersectionObserver)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('resize', resize)
      if (animationId) cancelAnimationFrame(animationId)
      if (patternTexture) gl.deleteTexture(patternTexture)
      if (positionBuffer) gl.deleteBuffer(positionBuffer)
      if (program) gl.deleteProgram(program)
    }
  }, [vertexSource, fragmentSource, patterns])

  useEffect(() => {
    const cleanup = run()
    return () => cleanup?.()
  }, [run])

  // When the canvas is static (no rAF loop), option changes won't be picked up
  // by a running frame, so re-evaluate the loop after every render. This either
  // keeps the existing loop, (re)starts it if `animated` flipped on, or draws a
  // single fresh frame to reflect the new options.
  useEffect(() => {
    ensureLoopRef.current?.()
  })

  return { canvasRef, containerRef, error, fps }
}
