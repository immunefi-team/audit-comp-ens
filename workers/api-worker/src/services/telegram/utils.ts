import { ResultFn } from '@ens-apps/utils/neverthrow'
import type {
  ApiMethods as ApiMethodsF,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  Opts as OptsF,
  ReplyKeyboardMarkup,
  Update,
} from '@grammyjs/types'
import { fromPromise, ok } from 'neverthrow'
import * as v from 'valibot'
import { createIntoError, error } from '#utils/result.js'
import { parseIntoResult } from '#utils/validation.js'

type Opts = OptsF<InputFile>
type ApiMethods = ApiMethodsF<InputFile>

// Define InputFile type for file uploads
export interface InputFile {
  file_id?: string
  url?: string
  // For multipart uploads, this would be a File/Blob object
  // but we'll handle this in the implementation
}

// Re-export commonly used types
export type {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  Update,
} from '@grammyjs/types'

const BASE_URL = 'https://api.telegram.org'

const ApiSuccessResponseSchema = v.object({
  ok: v.literal(true),
  result: v.unknown(),
})

const ApiErrorResponseSchema = v.object({
  ok: v.literal(false),
  error_code: v.number(),
  description: v.string(),
  parameters: v.optional(
    v.object({
      migrate_to_chat_id: v.optional(v.number()),
      retry_after: v.optional(v.number()),
    }),
  ),
})

const ApiResponseSchema = v.variant('ok', [
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
])

export const makeTelegramRequest = ResultFn(async function* <
  TMethod extends keyof Opts,
>(token: string, method: TMethod, body: Opts[TMethod]) {
  const url = new URL(`${BASE_URL}/bot${token}/${method}`)
  const response = yield* fromPromise(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    createIntoError('TELEGRAM_API_REQUEST_ERROR'),
  )

  const json = yield* fromPromise(
    response.json(),
    createIntoError('TELEGRAM_API_RESPONSE_PARSE_ERROR'),
  )

  const parsedResponse = yield* parseIntoResult(ApiResponseSchema, json, {
    code: 'TELEGRAM_API_RESPONSE_PARSE_ERROR',
    message: 'Failed to parse Telegram API response',
  })

  if (!parsedResponse.ok) {
    return error({
      code: 'TELEGRAM_API_REQUEST_ERROR',
      message: parsedResponse.description,
      errorCode: parsedResponse.error_code,
      parameters: parsedResponse.parameters,
    })
  }

  return ok(parsedResponse.result as ReturnType<ApiMethods[TMethod]>)
})

// ============================================================================
// WEBHOOK SETUP HELPERS (only where they add real value)
// ============================================================================

export const setupWebhook = async (
  token: string,
  webhookUrl: string,
  secretToken?: string,
) => {
  return makeTelegramRequest(token, 'setWebhook', {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query', 'chat_member'],
    drop_pending_updates: true,
  })
}

// ============================================================================
// WEBHOOK PARSING UTILITIES
// ============================================================================

export const parseWebhookUpdate = (body: string): Update => {
  try {
    return JSON.parse(body) as Update
  } catch {
    throw new Error('Invalid JSON in webhook body')
  }
}

export const verifyWebhookSecret = (
  request: Request,
  secretToken: string,
): boolean => {
  const providedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  return providedToken === secretToken
}

export const getUpdateType = (update: Update): string | null => {
  if (update.message) return 'message'
  if (update.edited_message) return 'edited_message'
  if (update.channel_post) return 'channel_post'
  if (update.edited_channel_post) return 'edited_channel_post'
  if (update.inline_query) return 'inline_query'
  if (update.chosen_inline_result) return 'chosen_inline_result'
  if (update.callback_query) return 'callback_query'
  if (update.shipping_query) return 'shipping_query'
  if (update.pre_checkout_query) return 'pre_checkout_query'
  if (update.poll) return 'poll'
  if (update.poll_answer) return 'poll_answer'
  if (update.my_chat_member) return 'my_chat_member'
  if (update.chat_member) return 'chat_member'
  if (update.chat_join_request) return 'chat_join_request'
  return null
}

export const getChatId = (update: Update): number | null => {
  const updateType = getUpdateType(update)

  switch (updateType) {
    case 'message':
    case 'edited_message':
      return update.message?.chat.id || null
    case 'channel_post':
    case 'edited_channel_post':
      return update.channel_post?.chat.id || null
    case 'callback_query':
      return update.callback_query?.message?.chat.id || null
    case 'my_chat_member':
      return update.my_chat_member?.chat.id || null
    case 'chat_member':
      return update.chat_member?.chat.id || null
    case 'chat_join_request':
      return update.chat_join_request?.chat.id || null
    default:
      return null
  }
}

export const getUserId = (update: Update): number | null => {
  const updateType = getUpdateType(update)

  switch (updateType) {
    case 'message':
    case 'edited_message':
      return update.message?.from?.id || null
    case 'channel_post':
    case 'edited_channel_post':
      return update.channel_post?.from?.id || null
    case 'inline_query':
      return update.inline_query?.from.id || null
    case 'chosen_inline_result':
      return update.chosen_inline_result?.from.id || null
    case 'callback_query':
      return update.callback_query?.from.id || null
    case 'shipping_query':
      return update.shipping_query?.from.id || null
    case 'pre_checkout_query':
      return update.pre_checkout_query?.from.id || null
    case 'poll_answer':
      return update.poll_answer?.user?.id || null
    case 'my_chat_member':
      return update.my_chat_member?.from.id || null
    case 'chat_member':
      return update.chat_member?.from.id || null
    case 'chat_join_request':
      return update.chat_join_request?.from.id || null
    default:
      return null
  }
}

// ============================================================================
// KEYBOARD HELPERS
// ============================================================================

export const createInlineKeyboard = (
  buttons: Array<
    Array<{
      text: string
      callbackData?: string
      url?: string
    }>
  >,
): InlineKeyboardMarkup => {
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((button) => {
        if (button.callbackData) {
          return {
            text: button.text,
            callback_data: button.callbackData,
          } as InlineKeyboardButton.CallbackButton
        }
        if (button.url) {
          return {
            text: button.text,
            url: button.url,
          } as InlineKeyboardButton.UrlButton
        }
        return {
          text: button.text,
        } as unknown as InlineKeyboardButton
      }),
    ),
  }
}

export const createReplyKeyboard = (
  buttons: Array<
    Array<{
      text: string
      requestContact?: boolean
      requestLocation?: boolean
    }>
  >,
  options?: {
    resizeKeyboard?: boolean
    oneTimeKeyboard?: boolean
    inputFieldPlaceholder?: string
    selective?: boolean
  },
): ReplyKeyboardMarkup => {
  return {
    keyboard: buttons.map((row) =>
      row.map((button) => ({
        text: button.text,
        ...(button.requestContact && {
          request_contact: button.requestContact,
        }),
        ...(button.requestLocation && {
          request_location: button.requestLocation,
        }),
      })),
    ),
    resize_keyboard: options?.resizeKeyboard,
    one_time_keyboard: options?.oneTimeKeyboard,
    input_field_placeholder: options?.inputFieldPlaceholder,
    selective: options?.selective,
  }
}

// ============================================================================
// ACCOUNT VERIFICATION & DEEPLINK HELPERS
// ============================================================================

export const createVerificationDeeplink = (
  botUsername: string,
  startParam?: string,
): string => {
  const baseUrl = `https://t.me/${botUsername}`
  return startParam ? `${baseUrl}?start=${startParam}` : baseUrl
}

export const createVerificationDeeplinkWithPayload = (
  botUsername: string,
  payload: string,
): string => {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`
}

export const parseStartParam = (text: string): string | null => {
  const match = text.match(/^\/start\s+(.+)$/)
  return match ? match[1] : null
}

export const isStartCommand = (text: string): boolean => {
  return text.startsWith('/start')
}

export const isCommand = (text: string): boolean => {
  return text.startsWith('/')
}

export const parseCommand = (
  text: string,
): { command: string; args: string[] } | null => {
  if (!isCommand(text)) return null

  const parts = text.split(' ')
  const command = parts[0].substring(1) // Remove the '/'
  const args = parts.slice(1)

  return { command, args }
}

// ============================================================================
// NOTIFICATION HELPERS (only where they add real value)
// ============================================================================

export const sendVerificationMessage = async (
  token: string,
  chatId: string | number,
  botUsername: string,
  verificationCode: string,
) => {
  const deeplink = createVerificationDeeplinkWithPayload(
    botUsername,
    verificationCode,
  )

  const keyboard = createInlineKeyboard([
    [
      {
        text: '🔗 Verify Account',
        url: deeplink,
      },
    ],
  ])

  return makeTelegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text:
      `🔐 **Account Verification Required**\n\n` +
      `To receive notifications, please verify your account by clicking the button below.\n\n` +
      `This will link your Telegram account to your notification preferences.`,
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  })
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

export const formatDomainName = (domain: string): string => {
  return domain.toLowerCase().trim()
}

export const isValidDomain = (domain: string): boolean => {
  // Basic domain validation - you might want to use a more robust validator
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain)
}

export const createNotificationMessage = (
  type: 'expiration' | 'registration' | 'transfer' | 'renewal',
  domain: string,
  details?: Record<string, unknown>,
): string => {
  const domainFormatted = formatDomainName(domain)

  switch (type) {
    case 'expiration': {
      const daysLeft = details?.daysLeft || 'unknown'
      return (
        `⚠️ **Domain Expiration Alert**\n\n` +
        `Domain: \`${domainFormatted}\`\n` +
        `Days until expiration: **${daysLeft}**\n\n` +
        `Don't forget to renew your domain!`
      )
    }

    case 'registration':
      return (
        `🎉 **Domain Registered**\n\n` +
        `Domain: \`${domainFormatted}\`\n` +
        `Registration confirmed!`
      )

    case 'transfer':
      return (
        `🔄 **Domain Transfer**\n\n` +
        `Domain: \`${domainFormatted}\`\n` +
        `Transfer completed successfully!`
      )

    case 'renewal': {
      const newExpiry = details?.newExpiry || 'unknown'
      return (
        `✅ **Domain Renewed**\n\n` +
        `Domain: \`${domainFormatted}\`\n` +
        `New expiry date: **${newExpiry}**`
      )
    }

    default:
      return (
        `📢 **Notification**\n\n` +
        `Domain: \`${domainFormatted}\`\n` +
        `Update: ${type}`
      )
  }
}
