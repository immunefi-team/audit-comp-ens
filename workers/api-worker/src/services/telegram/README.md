# Telegram API Wrapper for Cloudflare Workers

A lightweight, type-safe wrapper for the Telegram Bot API designed specifically for Cloudflare Workers. This wrapper provides a clean interface for sending messages and handling webhooks with full TypeScript support.

## Features

- 🚀 **Lightweight**: Minimal overhead, perfect for Cloudflare Workers
- 🔒 **Type Safe**: Full TypeScript support with `@grammyjs/types`
- 🎯 **Webhook Ready**: Built-in utilities for handling Telegram webhooks
- 🛠️ **Helper Functions**: Convenient methods for common operations
- 📱 **Keyboard Support**: Easy creation of inline and reply keyboards
- ⚡ **Error Handling**: Comprehensive error handling with custom error types

## Installation

The wrapper uses the `@grammyjs/types` package which is already installed in your project.

## Basic Usage

### Creating a Bot Instance

```typescript
import { TelegramBot } from './services/telegram/index.js'

const bot = new TelegramBot('YOUR_BOT_TOKEN')
```

### Sending Messages

```typescript
// Send a simple text message
await bot.sendMessage('123456789', 'Hello, World!')

// Send a message with options
await bot.sendMessage('123456789', 'Hello, World!', {
  parseMode: 'HTML',
  disableWebPagePreview: true,
  replyToMessageId: 123
})

// Send a photo
await bot.sendPhoto('123456789', 'https://example.com/image.jpg', {
  caption: 'Here is a photo!'
})

// Send a document
await bot.sendDocument('123456789', 'https://example.com/file.pdf', {
  caption: 'Here is a document!'
})
```

### Working with Keyboards

```typescript
import { createInlineKeyboard, createReplyKeyboard } from './services/telegram/index.js'

// Create an inline keyboard
const inlineKeyboard = createInlineKeyboard([
  [
    { text: 'Button 1', callbackData: 'btn1' },
    { text: 'Button 2', callbackData: 'btn2' }
  ],
  [
    { text: 'Visit Website', url: 'https://example.com' }
  ]
])

await bot.sendMessage('123456789', 'Choose an option:', {
  replyMarkup: inlineKeyboard
})

// Create a reply keyboard
const replyKeyboard = createReplyKeyboard([
  [{ text: 'Get Help' }],
  [{ text: 'Contact Support' }]
], {
  resizeKeyboard: true,
  oneTimeKeyboard: true
})

await bot.sendMessage('123456789', 'Welcome! How can I help you?', {
  replyMarkup: replyKeyboard
})
```

### Handling Callback Queries

```typescript
// Answer a callback query
await bot.answerCallbackQuery('callback_query_id', {
  text: 'Button pressed!',
  showAlert: true
})

// Edit a message
await bot.editMessageText('Updated text', {
  chatId: '123456789',
  messageId: 123
})
```

## Webhook Handling

### Setting Up Webhooks

```typescript
// Set webhook
await bot.setWebhook('https://your-worker.your-subdomain.workers.dev/webhook', {
  secretToken: 'your-secret-token',
  allowedUpdates: ['message', 'callback_query'],
  dropPendingUpdates: true
})

// Get webhook info
const info = await bot.getWebhookInfo()
console.log('Webhook info:', info)

// Delete webhook
await bot.deleteWebhook(true)
```

### Processing Webhook Updates

```typescript
import { TelegramWebhook } from './services/telegram/index.js'

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const body = await request.text()
      const update = TelegramWebhook.parseUpdate(body)
      
      const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN)
      const updateType = TelegramWebhook.getUpdateType(update)
      const chatId = TelegramWebhook.getChatId(update)
      const userId = TelegramWebhook.getUserId(update)
      
      // Handle different update types
      switch (updateType) {
        case 'message':
          if (update.message?.text) {
            await handleTextMessage(bot, update.message)
          }
          break
          
        case 'callback_query':
          await handleCallbackQuery(bot, update.callback_query!)
          break
      }
      
      return new Response('OK', { status: 200 })
      
    } catch (error) {
      console.error('Error processing webhook:', error)
      return new Response('Error processing webhook', { status: 500 })
    }
  }
}
```

### Webhook Security

```typescript
// Verify webhook secret token
const isValid = TelegramWebhook.verifySecretToken(request, 'your-secret-token')
if (!isValid) {
  return new Response('Unauthorized', { status: 401 })
}
```

## Error Handling

The wrapper includes a custom `TelegramError` class for better error handling:

```typescript
import { TelegramError } from './services/telegram/index.js'

try {
  await bot.sendMessage('123456789', 'Hello!')
} catch (error) {
  if (error instanceof TelegramError) {
    console.error('Telegram API error:', error.message)
    console.error('Error code:', error.errorCode)
    console.error('Parameters:', error.parameters)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Available Methods

### Core Methods
- `request(method, params)` - Make a raw API request
- `sendMessage(chatId, text, options)` - Send a text message
- `sendPhoto(chatId, photo, options)` - Send a photo
- `sendDocument(chatId, document, options)` - Send a document
- `editMessageText(text, options)` - Edit message text
- `deleteMessage(chatId, messageId)` - Delete a message
- `answerCallbackQuery(callbackQueryId, options)` - Answer callback query

### Webhook Methods
- `setWebhook(url, options)` - Set webhook URL
- `deleteWebhook(dropPendingUpdates)` - Delete webhook
- `getWebhookInfo()` - Get webhook information

### Utility Methods
- `getMe()` - Get bot information

### Webhook Utilities
- `TelegramWebhook.parseUpdate(body)` - Parse webhook update
- `TelegramWebhook.verifySecretToken(request, token)` - Verify secret token
- `TelegramWebhook.getUpdateType(update)` - Get update type
- `TelegramWebhook.getChatId(update)` - Extract chat ID
- `TelegramWebhook.getUserId(update)` - Extract user ID

## TypeScript Support

The wrapper exports all necessary types from `@grammyjs/types`:

```typescript
import type {
  Update,
  Message,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  ForceReply,
  InputFile,
} from './services/telegram/index.js'
```

## Examples

See `example.ts` for comprehensive usage examples including:
- Basic message sending
- Webhook handling
- Keyboard creation
- Error handling
- Bot setup

## Migration from Legacy Code

If you're migrating from the old `makeTelegramRequest` function, the wrapper maintains backward compatibility:

```typescript
// Old way (still works)
import { makeTelegramRequest } from './services/telegram/index.js'
const result = await makeTelegramRequest(token, 'sendMessage', { chat_id: '123', text: 'Hello' })

// New way (recommended)
import { TelegramBot } from './services/telegram/index.js'
const bot = new TelegramBot(token)
const result = await bot.sendMessage('123', 'Hello')
```

## Best Practices

1. **Error Handling**: Always wrap API calls in try-catch blocks
2. **Webhook Security**: Use secret tokens to verify webhook authenticity
3. **Rate Limiting**: Be mindful of Telegram's rate limits
4. **Type Safety**: Use TypeScript types for better development experience
5. **Resource Management**: Reuse bot instances when possible

## Limitations

- File uploads via multipart/form-data are not fully implemented (use file_id or URL instead)
- Some advanced features may require using the raw `request` method
- Designed specifically for Cloudflare Workers environment
