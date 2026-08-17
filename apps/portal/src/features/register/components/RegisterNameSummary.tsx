import { useQuery } from '@tanstack/react-query'
import { SirenIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { ExternalLink } from 'react-external-link'
import { match } from 'ts-pattern'
import { formatUnits } from 'viem'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PremiumCountdown } from '@/features/register/components/PremiumCountdown'
import { TemporaryPremiumPopover } from '@/features/register/components/TemporaryPremiumPopover'
import { useBaseRate } from '@/features/register/hooks/useBaseRate'
import { getOracleParamsQueryOptions } from '@/features/register/hooks/useOracleParams'
import {
  getRegistrationPriceQueryOptions,
  type RegistrationPriceResult,
} from '@/features/register/hooks/useRegistrationPrice'
import { getEffectivePricePerYearUsd } from '@/features/register/utils/effectivePricePerYear'
import { getPremiumLabel } from '@/features/register/utils/premium'
import { getPremiumInstantRangeFromPrice } from '@/features/register/utils/premiumDecay'
import { getRegistrationDisplayDates } from '@/features/register/utils/registrationDuration'
import {
  formatPriceDisplay,
  formatPriceExact,
  formatRegistrationTotal,
  getSavingsPct,
  isPriceResult,
} from '@/features/register/utils/registrationPrice'
import { TransactionErrorAlert } from '@/features/registry/components/TransactionErrorAlert'
import { getTransactionErrorInfo } from '@/features/registry/utils/transactionErrorMessage'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { ORACLE_PRICE_DECIMALS } from '@/lib/constants/oracle'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { validateNameLength } from '@/utils/token/nameValidation'

type RegisterNameCheckoutSummaryProps = {
  readonly name: string
  readonly duration: number
}

/** ENS docs explaining premium pricing for short names */
const ENS_PREMIUM_PRICING_DOCS_URL =
  'https://docs.ens.domains/registry/eth/#3-4-and-5-letter-names'

export const RegisterNameCheckoutSummary = ({
  name,
  duration,
}: RegisterNameCheckoutSummaryProps) => {
  const isNameValid = !validateNameLength(name)

  const {
    data: price,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...getRegistrationPriceQueryOptions({
      name,
      duration,
    }),
    enabled: Boolean(name) && duration > 0 && isNameValid,
  })

  const { data: oracleData } = useQuery(getOracleParamsQueryOptions)
  const baseRate = useBaseRate(name)

  const premiumDecayConfig = oracleData?.premiumDecay

  const hasPrice = price && isPriceResult(price)

  const premiumRange =
    hasPrice && price
      ? getPremiumInstantRangeFromPrice(price, premiumDecayConfig)
      : null

  return (
    <Fragment>
      {premiumRange && (
        <Alert variant="warning" className="flex p-5 items-center">
          <AlertDescription className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
            <SirenIcon className="size-6 shrink-0" />
            <p className="text-center md:text-left">
              This name is subject to a temporary premium for{' '}
              <PremiumCountdown end={premiumRange.end} />
            </p>
            {premiumDecayConfig && (
              <TemporaryPremiumPopover
                premiumStart={premiumRange.start}
                premiumDecayConfig={premiumDecayConfig}
                trigger={(open) => (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent hover:bg-transparent text-sm"
                  >
                    {open ? 'Close' : 'Learn more'}
                  </Button>
                )}
              />
            )}
          </AlertDescription>
        </Alert>
      )}
      <section
        className="border border-border rounded-xl p-6"
        aria-label="Checkout summary"
      >
        {match({ isLoading, isError, hasPrice })
          .with({ isLoading: true }, () => <PriceBreakdownSkeleton />)
          .with({ isError: true }, () => {
            const errorInfo = error ? getTransactionErrorInfo(error) : null
            return (
              <TransactionErrorAlert
                title="Failed to load price"
                summary={
                  errorInfo?.summary ??
                  'Failed to load price. Please try again.'
                }
                details={errorInfo?.details}
              />
            )
          })
          .with({ hasPrice: true }, () =>
            price ? (
              <PriceBreakdown
                name={name}
                price={price}
                duration={duration}
                baseRate={baseRate}
              />
            ) : null,
          )
          .otherwise(() => (
            <div className="border border-border rounded-md p-4">
              <p className="text-muted-foreground text-sm">
                Unable to load price
              </p>
            </div>
          ))}
      </section>
    </Fragment>
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
  <div className={cn('flex items-center justify-between', className)}>
    <dt className={cn('font-normal text-muted-foreground', labelClassName)}>
      {label}
    </dt>
    <dd className={cn('m-0 font-normal text-foreground', valueClassName)}>
      {value}
    </dd>
  </div>
)

const PriceBreakdownSkeleton = () => (
  <div className="space-y-2">
    <dl className="space-y-2">
      <SummaryRow label="Expires" value={<Skeleton className="h-5 w-24" />} />
      <SummaryRow
        label="Registration"
        value={<Skeleton className="h-5 w-16" />}
      />
      <SummaryRow label="Price" value={<Skeleton className="h-5 w-20" />} />

      <SummaryRow
        label="Total"
        value={<Skeleton className="h-8 w-20" />}
        className="pt-3 border-t border-border"
        labelClassName="text-2xl text-primary font-medium"
        valueClassName="m-0 text-primary font-semibold text-2xl"
      />
    </dl>
  </div>
)

type PriceBreakdownProps = {
  readonly name: string
  readonly price: RegistrationPriceResult
  readonly duration: number
  readonly baseRate: bigint
}

const PriceBreakdown = ({
  name,
  price,
  duration,
  baseRate,
}: PriceBreakdownProps) => {
  const { registrationPeriod, expiresFormatted } =
    getRegistrationDisplayDates(duration)

  const years = duration / CONTRACT_SECONDS_PER_YEAR
  const pricePerYear = getEffectivePricePerYearUsd({
    priceBase: price.base,
    priceDecimals: price.decimals,
    durationSeconds: duration,
    baseRate,
  })
  // Undiscounted 1-year rack rate (baseRate × secondsPerYear) as the baseline.
  const rackRatePerYear = Number(
    formatUnits(
      baseRate * BigInt(CONTRACT_SECONDS_PER_YEAR),
      ORACLE_PRICE_DECIMALS,
    ),
  )
  const savePct = getSavingsPct(pricePerYear, rackRatePerYear)
  const premiumLabel = getPremiumLabel(name)
  const showPriceRow = pricePerYear > 0 && Math.round(years * 12) >= 12

  return (
    <div className="space-y-2">
      <dl className="space-y-2">
        <SummaryRow label="Expires" value={expiresFormatted} />
        <SummaryRow label="Registration" value={registrationPeriod} />

        {showPriceRow && (
          <SummaryRow
            label={
              premiumLabel ? (
                <ExternalLink
                  href={ENS_PREMIUM_PRICING_DOCS_URL}
                  className="underline decoration-dotted underline-offset-2"
                >
                  {premiumLabel.label}
                </ExternalLink>
              ) : (
                'Price'
              )
            }
            value={
              <span className="flex items-center justify-end gap-2">
                {savePct > 0 ? (
                  <Badge variant="success">{`Save ${savePct}%`}</Badge>
                ) : null}
                <span>{`${formatUsd(pricePerYear)}/year`}</span>
              </span>
            }
          />
        )}

        {price.hasPremium ? (
          <>
            <hr className="border-border my-3" />
            <SummaryRow
              label="Subtotal"
              value={formatPriceDisplay(price.base, price.decimals)}
            />
            <SummaryRow
              label="Surcharge"
              value={
                <span className="flex items-center justify-end gap-2">
                  <Badge className="border-transparent bg-warning-fill text-warning-text">
                    Premium
                  </Badge>
                  <span>{formatPriceExact(price.premium, price.decimals)}</span>
                </span>
              }
            />
          </>
        ) : null}

        <SummaryRow
          label="Total"
          value={formatRegistrationTotal(
            price.base,
            price.premium,
            price.decimals,
          )}
          className="pt-3 border-t border-border"
          labelClassName="text-2xl text-primary font-medium"
          valueClassName="m-0 text-primary font-semibold text-2xl"
        />
      </dl>
    </div>
  )
}
