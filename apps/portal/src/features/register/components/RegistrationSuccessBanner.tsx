import { CircleCheck } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { formatRegistrationDuration } from '@/features/register/utils/registrationDuration'

type RegistrationSuccessBannerProps = {
  readonly name: string
  readonly durationSeconds: number
  readonly paid: string
}

export const RegistrationSuccessBanner = ({
  name,
  durationSeconds,
  paid,
}: RegistrationSuccessBannerProps) => (
  <Alert
    variant="success"
    className="flex flex-wrap items-center justify-between gap-3"
  >
    <div className="flex items-start gap-3">
      <CircleCheck className="size-6 shrink-0 mt-1.5" />
      <div>
        <p className="text-3xl font-serif font-normal leading-none tracking-[-0.02em]">
          Congratulations!
        </p>
        <p className="text-p">You are the owner of {name}</p>
      </div>
    </div>
    <div className="flex items-center gap-8 text-right">
      <div>
        <p className="text-h3">{formatRegistrationDuration(durationSeconds)}</p>
        <p className="text-p">Registration</p>
      </div>
      <div>
        <p className="text-h3">{paid}</p>
        <p className="text-p">Paid</p>
      </div>
    </div>
  </Alert>
)
