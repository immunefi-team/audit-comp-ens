import { Trans } from '@lingui/react/macro'
import { useSelector } from '@xstate/react'
import { format } from 'date-fns'
import {
  getDurationExpiryDateForDisplay,
  getStartOfDay,
} from '@/features/register-v2/utils/time'
import { useRegistrationV2Context } from '../../../state/registrationUi.context'
import { DurationLabel } from './DurationLabel'

export const PricingSummaryCard = () => {
  const { uiActor } = useRegistrationV2Context()
  const [duration, expirationDate] = useSelector(
    uiActor,
    (state) =>
      [
        state.context.duration,
        getDurationExpiryDateForDisplay(
          state.context.duration,
          getStartOfDay(),
        ),
      ] as const,
    (a, b) => a[0] === b[0] && a[1].getTime() === b[1].getTime(),
  )

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-[#DDDDDE] border-[0.5px] bg-white px-6 py-8 text-center font-[350] text-neutral-800 text-xl leading-ens-none shadow-temp-card md:py-6 md:text-2xl">
      <div className="flex flex-wrap items-baseline justify-center gap-x-1 text-center">
        <span>
          <Trans>Registering for</Trans>
        </span>
        <span className="font-[425] text-[#024A70]">
          <DurationLabel duration={duration} referenceDate={getStartOfDay()} />
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-center gap-x-1 text-center">
        <span>
          <Trans>expiring on</Trans>
        </span>
        <span className="font-[425] text-[#024A70]">
          {format(expirationDate, 'MMMM d, yyyy')}
        </span>
      </div>
    </div>
  )
}
