import { useEffect, useState } from 'react'
import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@/lib/constants/duration'

type PremiumCountdownProps = {
  readonly end: Temporal.Instant
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Tracks the current time in epoch ms, re-rendering once per `intervalMs`. */
const useNowMs = (intervalMs: number) => {
  const [nowMs, setNowMs] = useState(
    () => Temporal.Now.instant().epochMilliseconds,
  )

  useEffect(() => {
    const id = setInterval(
      () => setNowMs(Temporal.Now.instant().epochMilliseconds),
      intervalMs,
    )
    return () => clearInterval(id)
  }, [intervalMs])

  return nowMs
}

export const PremiumCountdown = ({ end }: PremiumCountdownProps) => {
  const nowMs = useNowMs(1000)

  const totalSeconds = Math.max(
    0,
    Math.floor((end.epochMilliseconds - nowMs) / 1000),
  )
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  )
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  return (
    <span className="tabular-nums whitespace-nowrap font-medium">
      {days} {days === 1 ? 'day' : 'days'} : {pad(hours)} : {pad(minutes)} :{' '}
      {pad(seconds)}
    </span>
  )
}
