// ---------------------------------------------------------------------------
// Chart hooks
//
// React hooks used by TemporaryPremiumChart: element-size observation and the
// rAF-based value tween that animates the "now" price as it decays.
// ---------------------------------------------------------------------------

import { type RefObject, useEffect, useRef, useState } from 'react'

type Size = {
  width: number
  height: number
}

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

export type EasingFn = (t: number) => number

export const easeOutCubic: EasingFn = (t) => 1 - (1 - t) ** 3
export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
export const linear: EasingFn = (t) => t

export type UseTweenedValueOptions = {
  duration?: number
  easing?: EasingFn
  disabled?: boolean
}

export function useTweenedValue(
  target: number,
  options: UseTweenedValueOptions = {},
): number {
  const { duration = 600, easing = easeOutCubic, disabled = false } = options

  const [display, setDisplay] = useState<number>(target)
  const startValueRef = useRef<number>(target)
  const startTimeRef = useRef<number>(0)
  const targetRef = useRef<number>(target)
  const rafRef = useRef<number | null>(null)
  const displayRef = useRef<number>(target)
  displayRef.current = display

  useEffect(() => {
    if (disabled) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setDisplay(target)
      targetRef.current = target
      return
    }

    if (target === targetRef.current) return

    startValueRef.current = displayRef.current
    startTimeRef.current = performance.now()
    targetRef.current = target

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = Math.min(1, elapsed / duration)
      const eased = easing(progress)
      const next =
        startValueRef.current +
        (targetRef.current - startValueRef.current) * eased

      setDisplay(next)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [target, duration, easing, disabled])

  return disabled ? target : display
}
