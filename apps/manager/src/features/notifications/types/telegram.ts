import type { TelegramAuthData } from '@ens-apps/shared-schema/telegram'

// Telegram step types
export type TelegramStep = 'auth' | 'create'

export interface TelegramStepState {
  currentStep: TelegramStep
  telegramAuthData: TelegramAuthData | null
  isAuthenticating: boolean
  authError: string | null
  isCreatingChannel: boolean
  isChannelCreated: boolean
  channelError: string | null
}

export interface TelegramStepActions {
  onTelegramAuth: () => void
  onCreateChannel: () => void
  onBackToAuth: () => void
  onCancel: () => void
}

export interface TelegramStepProps {
  state: TelegramStepState
  actions: TelegramStepActions
}

// Telegram login options
export interface TelegramLoginOptions {
  botId?: string
  requestAccess?: 'write' | 'read'
  lang?: string
}
