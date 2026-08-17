import { CopyableRecord } from '@/components/CopyableRecord'
import { RegistrationDurationOrExpiryPicker } from './RegistrationDurationOrExpiryPicker'

type RegisterNameFormProps = {
  readonly name: string
  readonly duration: number
  readonly setDuration: (seconds: number) => void
  readonly disabled?: boolean
}

export const RegisterNameForm = ({
  name,
  duration,
  setDuration,
  disabled = false,
}: RegisterNameFormProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CopyableRecord
          value={name}
          textClassName="text-3xl font-serif sm:text-5xl font-medium"
        />
      </div>

      <RegistrationDurationOrExpiryPicker
        duration={duration}
        setDuration={setDuration}
        disabled={disabled}
        name={name}
      />
    </div>
  )
}
