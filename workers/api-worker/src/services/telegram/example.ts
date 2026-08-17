/**
 * Example usage of the simplified Telegram API helpers
 * This demonstrates the lightweight approach with just the core request function
 * and helper functions that add real value
 */

import type { CallbackQuery, Message } from '@grammyjs/types'
import {
  createInlineKeyboard,
  createNotificationMessage,
  createVerificationDeeplinkWithPayload,
  getChatId,
  getUpdateType,
  getUserId,
  makeTelegramRequest,
  parseCommand,
  parseStartParam,
  parseWebhookUpdate,
  sendVerificationMessage,
  setupWebhook,
  verifyWebhookSecret,
} from './utils.js'

// Example: Basic message sending using the core request function
export async function sendBasicMessage(
  token: string,
  chatId: string,
  text: string,
) {
  return makeTelegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text,
  })
}

// Example: Send message with inline keyboard
export async function sendMessageWithKeyboard(token: string, chatId: string) {
  const keyboard = createInlineKeyboard([
    [
      { text: 'Button 1', callbackData: 'btn1' },
      { text: 'Button 2', callbackData: 'btn2' },
    ],
    [{ text: 'Visit Website', url: 'https://example.com' }],
  ])

  return makeTelegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Choose an option:',
    reply_markup: keyboard,
  })
}

// Example: Send photo
export async function sendPhoto(
  token: string,
  chatId: string,
  photoUrl: string,
) {
  return makeTelegramRequest(token, 'sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: 'Here is a photo!',
  })
}

// Example: Webhook handler
export async function handleWebhook(
  request: Request,
  token: string,
  secretToken: string,
) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify webhook secret
  if (!verifyWebhookSecret(request, secretToken)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.text()
    const update = parseWebhookUpdate(body)

    const updateType = getUpdateType(update)
    const chatId = getChatId(update)
    const userId = getUserId(update)

    console.log('Received update:', { updateType, chatId, userId })

    // Handle different update types
    switch (updateType) {
      case 'message':
        if (update.message?.text) {
          await handleTextMessage(token, update.message)
        }
        break

      case 'callback_query':
        // biome-ignore lint/style/noNonNullAssertion: callback_query guaranteed by 'callback_query' case
        await handleCallbackQuery(token, update.callback_query!)
        break

      default:
        console.log('Unhandled update type:', updateType)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Error processing webhook', { status: 500 })
  }
}

// Example: Handle text messages
async function handleTextMessage(token: string, message: Message) {
  const chatId = message.chat.id
  const text = message.text

  if (!text) return

  if (text.startsWith('/start')) {
    const startParam = parseStartParam(text)
    if (startParam) {
      // Handle verification code from deeplink
      console.log('Verification code:', startParam)
      await makeTelegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: `Welcome! Verification code: ${startParam}`,
      })
    } else {
      await makeTelegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Welcome! Use /help for available commands.',
      })
    }
  } else if (text.startsWith('/help')) {
    await makeTelegramRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: 'Available commands:\n/start - Start the bot\n/help - Show this help',
    })
  } else if (text.startsWith('/')) {
    const command = parseCommand(text)
    if (command) {
      console.log('Command:', command.command, 'Args:', command.args)
      await makeTelegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: `Command: ${command.command}\nArgs: ${command.args.join(' ')}`,
      })
    }
  } else {
    // Echo the message back
    await makeTelegramRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: `You said: ${text}`,
    })
  }
}

// Example: Handle callback queries
async function handleCallbackQuery(
  token: string,
  callbackQuery: CallbackQuery,
) {
  const chatId = callbackQuery.message?.chat.id
  const data = callbackQuery.data
  const queryId = callbackQuery.id

  // Answer the callback query
  await makeTelegramRequest(token, 'answerCallbackQuery', {
    callback_query_id: queryId,
    text: `You pressed: ${data}`,
  })

  if (chatId && callbackQuery.message) {
    // Edit the original message
    await makeTelegramRequest(token, 'editMessageText', {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      text: `You selected: ${data}`,
    })
  }
}

// Example: Setup webhook
export async function setupTelegramWebhook(
  token: string,
  webhookUrl: string,
  secretToken?: string,
) {
  try {
    await setupWebhook(token, webhookUrl, secretToken)
    console.log('Webhook set successfully')

    // Get webhook info
    const info = await makeTelegramRequest(token, 'getWebhookInfo', {})
    console.log('Webhook info:', info)
  } catch (error) {
    console.error('Error setting webhook:', error)
  }
}

// Example: Send verification message with deeplink
export async function sendAccountVerification(
  token: string,
  chatId: string,
  botUsername: string,
  verificationCode: string,
) {
  return sendVerificationMessage(token, chatId, botUsername, verificationCode)
}

// Example: Send domain notification
export async function sendDomainNotification(
  token: string,
  chatId: string,
  type: 'expiration' | 'registration' | 'transfer' | 'renewal',
  domain: string,
  details?: Record<string, unknown>,
) {
  const message = createNotificationMessage(type, domain, details)

  return makeTelegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
  })
}

// Example: Create deeplink for account verification
export function createAccountVerificationLink(
  botUsername: string,
  verificationCode: string,
): string {
  return createVerificationDeeplinkWithPayload(botUsername, verificationCode)
}

// Example: Get bot information
export async function getBotInfo(token: string) {
  try {
    const botInfo = await makeTelegramRequest(token, 'getMe', {})
    console.log('Bot info:', botInfo)
    return botInfo
  } catch (error) {
    console.error('Error getting bot info:', error)
    return null
  }
}
