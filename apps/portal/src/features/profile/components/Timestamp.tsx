import { formatUnixDateTimeLocal } from '@/utils/formatting/formatDateTime'

type TimestampProps = {
  timestamp: number | bigint
}

/**
 * Date + local time on a single line. The 190px floor is what keeps these
 * out of a second line in the overview's metadata column.
 */
export const Timestamp = ({ timestamp }: TimestampProps) => (
  <span className="inline-block min-w-47.5 whitespace-nowrap">
    {formatUnixDateTimeLocal(timestamp)}
  </span>
)
