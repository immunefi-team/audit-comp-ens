import { Trans } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'
import { tw } from '@/utils/tailwind'

type PriceCooldownBannerHeaderProps = {
  periodDays: number
}

const HourglassIcon = () => (
  <div className="flex size-8 shrink-0 items-center justify-center rounded border-[#0082bb] border-[0.5px] bg-ens-lapis-500 p-1">
    <MSymbol
      className="ms-opsz-24 ms-wght-400 text-ens-lapis-tint"
      symbol="hourglass"
    />
  </div>
)

const CooldownDescription = ({
  periodDays,
  className,
}: {
  periodDays: number
  className?: string
}) => (
  <p
    className={tw(
      'text-[#3f3f3e] text-sm leading-[1.2] tracking-wide',
      className,
    )}
  >
    <Trans>
      Recently expired names have a temporary fee that decreases to $0 over{' '}
      {periodDays} days. It&apos;s added only once when you register — renewals
      are always at the base price.
    </Trans>
  </p>
)

export const PriceCooldownBannerHeader = ({
  periodDays,
}: PriceCooldownBannerHeaderProps) => (
  <div className="flex min-w-0 items-start gap-3 md:gap-4">
    <HourglassIcon />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-3">
      <h2
        className={tw(
          'font-normal text-[#353535] leading-[1.1] tracking-tight',
          'text-base md:whitespace-nowrap md:text-xl',
        )}
      >
        <Trans>This name is in price cooldown</Trans>
      </h2>
      <CooldownDescription
        className="md:max-w-[600px]"
        periodDays={periodDays}
      />
    </div>
  </div>
)
