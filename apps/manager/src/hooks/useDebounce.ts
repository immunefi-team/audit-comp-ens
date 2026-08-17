import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useDebounce - Debounce a value and optionally call a callback
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 1000)
 * @param callback - Optional callback to call when debounced value changes
 * @param immediateCallback - Optional callback to call immediately when value is empty
 *
 * @returns An object with the debounced value and a cancel function
 *
 * @example
 * ```tsx
 * const [input, setInput] = useState('')
 * const { debouncedValue, cancel } = useDebounce(input, 1000, (debounced) => {
 *   search(debounced)
 * })
 * ```
 *
 * @example
 * ```tsx
 * const [input, setInput] = useState('')
 * const { debouncedValue, cancel } = useDebounce(
 *   input,
 *   1000,
 *   (debounced) => search(debounced),
 *   () => resetSearch() // Called immediately when input is empty
 * )
 *
 * // Cancel pending debounce when user presses Enter
 * const handleEnter = () => {
 *   cancel()
 *   search(input)
 * }
 * ```
 */

const DEFAULT_DELAY = 1000
export function useDebounce<T>(
  value: T,
  options?: {
    delay?: number
    callback?: (debouncedValue: T) => void
    immediateCallback?: () => void
  },
): { debouncedValue: T; cancel: () => void } {
  const delay = options?.delay ?? DEFAULT_DELAY
  const callback = options?.callback
  const immediateCallback = options?.immediateCallback
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    // Clear any existing timer
    cancel()

    // If value is empty and immediateCallback is provided, call it immediately
    if (
      (value === '' || value === null || value === undefined) &&
      immediateCallback
    ) {
      immediateCallback()
      setDebouncedValue(value)
      return
    }

    // Set up debounced update
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
      if (callback) {
        callback(value)
      }
    }, delay)

    // Cleanup function
    return () => {
      cancel()
    }
  }, [value, delay, callback, immediateCallback, cancel])

  return { debouncedValue, cancel }
}
