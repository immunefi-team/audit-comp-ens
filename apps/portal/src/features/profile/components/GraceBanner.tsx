import { AssuredWorkloadIcon } from '@/assets/icons'

type GraceBannerProps = {
  readonly graceEndDate: Date
  readonly canExtend: boolean
}

export const GraceBanner = ({ graceEndDate, canExtend }: GraceBannerProps) => {
  const formattedDate = graceEndDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'long',
  })

  const description = canExtend
    ? `The grace period for this name ends on ${formattedDate}. If it isn't extended before this date, it will become available for registration.`
    : `The grace period for this name ends on ${formattedDate}. After this date, it will become available for registration.`

  return (
    <div className="flex items-start gap-3 p-6 self-stretch rounded-sm bg-message-danger-fill">
      <AssuredWorkloadIcon className="size-6 shrink-0 text-message-danger-text mt-0.5" />
      <div className="flex flex-col gap-1">
        <span
          className="font-[350] leading-none tracking-[-0.6px]"
          style={{
            color: 'var(--message-danger-text, #9a1b10)',
            fontSize: 'var(--3xl, 30px)',
          }}
        >
          This name has expired
        </span>
        <p className="text-sm text-message-danger-text">{description}</p>
      </div>
    </div>
  )
}
