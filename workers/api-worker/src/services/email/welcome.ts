import { ResultFn } from '@ens-apps/utils/neverthrow'
import { ok } from 'neverthrow'
import { logger } from '#utils/logger.js'
import { type MailJSONRequired, sendMailV3 } from './utils.js'

/**
 * Sends a welcome email to the user after email verification
 */
export const sendWelcomeEmail = ResultFn(async function* (
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  managerAppUrl: string,
) {
  const preferencesUrl = `${managerAppUrl}/notifications/settings`

  // SendGrid API format for direct emails (not using templates)
  const emailContent: MailJSONRequired = {
    personalizations: [
      {
        to: [{ email: toEmail }],
      },
    ],
    from: { email: fromEmail },
    subject: 'Welcome to ENS Notifications',
    content: [
      {
        type: 'text/plain',
        value: `Welcome to ENS Notifications!

Your email has been successfully verified and you're all set to receive notifications about your ENS domains.

You'll receive updates about:
- Domain expiry reminders
- Domain transfers
- And other important events

Manage your notification preferences anytime at:
${preferencesUrl}

Thank you for using ENS!`,
      },
      {
        type: 'text/html',
        value: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px 20px; border: 1px solid #e5e7eb;">
    <h1 style="color: #111827; font-size: 24px; margin-top: 0; margin-bottom: 20px;">Welcome to ENS Notifications!</h1>

    <p style="color: #4b5563; font-size: 16px; margin-bottom: 20px;">
      Your email has been successfully verified and you're all set to receive notifications about your ENS domains.
    </p>

    <p style="color: #4b5563; font-size: 16px; margin-bottom: 10px;">
      You'll receive updates about:
    </p>

    <ul style="color: #4b5563; font-size: 16px; margin-bottom: 30px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Domain expiry reminders</li>
      <li style="margin-bottom: 8px;">Domain transfers</li>
      <li style="margin-bottom: 8px;">And other important events</li>
    </ul>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${preferencesUrl}"
         style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Manage Notification Preferences
      </a>
    </div>

    <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        You can customize which notifications you receive at any time from your notification settings.
      </p>
    </div>
  </div>

  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
    Thank you for using ENS Notifications!
  </p>
</body>
</html>
        `.trim(),
      },
    ],
  }

  const result = yield* sendMailV3(apiKey, emailContent)

  logger.info('Welcome email sent', {
    to: toEmail,
  })

  return ok(result)
})
