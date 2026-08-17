// Email verification step types
export type EmailStep = 'send' | 'verify'

// Email channel form props
export interface EmailChannelFormProps {
  onSuccess: () => void
  onCancel: () => void
}
