import { useCallback, useEffect, useState } from 'react'

interface UseCountdownOptions {
  interval?: number
  onComplete?: () => void
}

export const useCountdown = (
  targetTimestamp: number | null,
  options?: UseCountdownOptions,
) => {
  const { interval = 1000, onComplete } = options || {}
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  const calculateRemaining = useCallback(() => {
    if (targetTimestamp === null) {
      return null
    }
    const diff = targetTimestamp - Date.now()
    return Math.max(0, Math.ceil(diff / 1000))
  }, [targetTimestamp])

  useEffect(() => {
    setRemainingSeconds(calculateRemaining())

    if (targetTimestamp === null) {
      return
    }

    const timer = setInterval(() => {
      const newRemaining = calculateRemaining()
      setRemainingSeconds(newRemaining)

      if (newRemaining !== null && newRemaining <= 0) {
        clearInterval(timer)
        onComplete?.()
      }
    }, interval)

    return () => clearInterval(timer)
  }, [targetTimestamp, interval, onComplete, calculateRemaining])

  const isComplete = remainingSeconds !== null && remainingSeconds <= 0
  const isActive = remainingSeconds !== null && remainingSeconds > 0

  const minutes =
    remainingSeconds === null ? 0 : Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds === null ? 0 : remainingSeconds % 60

  const formatted = {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    display:
      remainingSeconds === null
        ? '--:--'
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  }

  return {
    remainingSeconds,
    isComplete,
    isActive,
    formatted,
  }
}
