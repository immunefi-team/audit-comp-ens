import { Hourglass } from 'lucide-react'
import { useEffect, useState } from 'react'

type TransactionWaitCountdownProps = {
  /** Unix ms timestamp at which the wait ends */
  readonly waitUntil: number
  readonly className?: string
}

/**
 * Renders a countdown that ticks every second and disappears once the
 * deadline is reached. Used to surface the registration commit-reveal
 * cooldown so the user knows the modal is waiting on-chain timing rather
 * than being stuck.
 */
export const TransactionWaitCountdown = ({
  waitUntil,
  className,
}: TransactionWaitCountdownProps) => {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, waitUntil - Date.now()),
  )

  useEffect(() => {
    setRemainingMs(Math.max(0, waitUntil - Date.now()))
    if (waitUntil <= Date.now()) return

    const interval = setInterval(() => {
      const next = Math.max(0, waitUntil - Date.now())
      setRemainingMs(next)
      if (next <= 0) clearInterval(interval)
    }, 500)

    return () => clearInterval(interval)
  }, [waitUntil])

  if (remainingMs <= 0) return null

  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <span
      className={
        'inline-flex items-center gap-1 text-xs text-muted-foreground ' +
        (className ?? '')
      }
    >
      <Hourglass className="size-3 animate-spin" />
      Ready in {seconds}s
    </span>
  )
}
