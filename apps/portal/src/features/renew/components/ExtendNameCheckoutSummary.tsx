import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionErrorAlert } from '@/features/registry/components/TransactionErrorAlert'
import { getTransactionErrorInfo } from '@/features/registry/utils/transactionErrorMessage'
import { cn } from '@/lib/utils'
import { useNamePricing } from '../hooks/useNamePricing'
import type { SelectedName } from '../hooks/useRenewalTransactions'
import type { NamePricingDisplay } from '../utils/computeNamePricingDisplay'
import type { ExtensionSpanType } from './ExtensionDurationOrExpiryPicker'

type ExtendNameCheckoutSummaryProps = {
  readonly selectedName: SelectedName
  readonly duration: number
  readonly spanType: ExtensionSpanType
  readonly baseDate?: Temporal.PlainDate
}

export const ExtendNameCheckoutSummary = ({
  selectedName,
  duration,
  spanType,
  baseDate,
}: ExtendNameCheckoutSummaryProps) => {
  const { display, isLoading, isError, error } = useNamePricing(
    selectedName,
    duration,
    spanType,
    baseDate,
  )

  return (
    <section
      className="border border-border rounded-sm py-5"
      aria-label="Extension summary"
    >
      {match({ isLoading, isError, hasDisplay: display !== null })
        .with({ isLoading: true }, () => <ExtensionSkeleton />)
        .with({ isError: true }, () => {
          const errorInfo = error ? getTransactionErrorInfo(error) : null
          return (
            <TransactionErrorAlert
              title="Failed to load price"
              summary={
                errorInfo?.summary ?? 'Failed to load price. Please try again.'
              }
              details={errorInfo?.details}
            />
          )
        })
        .with({ hasDisplay: true }, () =>
          display ? <ExtensionPriceBreakdown display={display} /> : null,
        )
        .otherwise(() => (
          <div className="border border-border rounded-md p-4">
            <p className="text-muted-foreground text-sm">
              Unable to load price
            </p>
          </div>
        ))}
    </section>
  )
}

type SummaryRowProps = {
  readonly label: ReactNode
  readonly value: ReactNode
  readonly className?: string
  readonly labelClassName?: string
  readonly valueClassName?: string
}

const SummaryRow = ({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: SummaryRowProps) => (
  <div className={cn('flex items-center justify-between px-5', className)}>
    <dt className={cn('text-base font-normal text-foreground', labelClassName)}>
      {label}
    </dt>
    <dd className={cn('m-0 font-normal text-foreground', valueClassName)}>
      {value}
    </dd>
  </div>
)

const ExtensionSkeleton = () => (
  <dl className="space-y-2">
    <SummaryRow label="Extension:" value={<Skeleton className="h-5 w-16" />} />
    <SummaryRow label="New expiry:" value={<Skeleton className="h-5 w-24" />} />
    <hr className="border-border" />
    <SummaryRow label="Price:" value={<Skeleton className="h-5 w-20" />} />
    <SummaryRow
      label="Total:"
      value={<Skeleton className="h-7 w-14" />}
      className="pt-3 border-t border-border"
      labelClassName="text-xl text-primary font-medium"
    />
  </dl>
)

const ExtensionPriceBreakdown = ({
  display,
}: {
  readonly display: NamePricingDisplay
}) => {
  const {
    registrationPeriod,
    newExpiryFormatted,
    priceLabel,
    priceValue,
    discountSublabel,
    total,
  } = display

  return (
    <dl className="space-y-2">
      <SummaryRow label="Extension:" value={registrationPeriod} />
      <SummaryRow label="New expiry:" value={newExpiryFormatted} />

      <hr className="border-border my-3" />

      <SummaryRow
        label={priceLabel}
        value={
          <span className="flex flex-col items-end m-0">
            <span>{priceValue}</span>
            {discountSublabel ? (
              <span className="text-xs text-success-text">
                {discountSublabel}
              </span>
            ) : null}
          </span>
        }
      />

      <SummaryRow
        label="Total:"
        value={total}
        className="pt-3 border-t border-border"
        labelClassName="text-xl text-primary font-medium"
        valueClassName="flex items-center gap-1 m-0 text-primary font-medium text-xl"
      />
    </dl>
  )
}
