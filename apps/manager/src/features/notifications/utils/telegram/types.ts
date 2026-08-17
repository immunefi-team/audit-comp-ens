import type { TelegramAuthData } from '@ens-apps/shared-schema/telegram'

export interface TelegramLoginOptions {
  botId?: string
  requestAccess?: 'write' | 'read'
  lang?: string
}

export type { TelegramAuthData }
