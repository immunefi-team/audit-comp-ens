import { cn } from '@/lib/utils'

type RenewalDetailRowProps = {
  readonly label: string
  readonly labelClassName?: string
  readonly value: string
  readonly valueClassName?: string
}

export const RenewalDetailRow = ({
  label,
  labelClassName,
  value,
  valueClassName,
}: RenewalDetailRowProps) => (
  <div className="flex items-center justify-between">
    <dt className={cn('text-sm text-muted-foreground', labelClassName)}>
      {label}
    </dt>
    <dd className={cn('text-sm text-foreground m-0', valueClassName)}>
      {value}
    </dd>
  </div>
)
