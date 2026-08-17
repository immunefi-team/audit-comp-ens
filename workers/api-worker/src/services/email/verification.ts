import { ResultFn } from '@ens-apps/utils/neverthrow'
import { ok } from 'neverthrow'
import { logger } from '#utils/logger.js'
import { type MailJSONRequired, sendMailV3 } from './utils.js'

/**
 * Sends an email verification email to the user
 */
export const sendVerificationEmail = ResultFn(async function* (
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  verificationToken: string,
  managerAppUrl: string,
) {
  const verificationUrl = `${managerAppUrl}/notifications/channels/email/verify?token=${encodeURIComponent(verificationToken)}`

  // SendGrid API format for direct emails (not using templates)
  const emailContent: MailJSONRequired = {
    personalizations: [
      {
        to: [{ email: toEmail }],
      },
    ],
    from: { email: fromEmail },
    subject: 'Verify your email address - ENS Notifications',
    content: [
      {
        type: 'text/plain',
        value: `Verify your email address - ENS Notifications

Thank you for signing up for ENS notifications! Please verify your email address by clicking the link below.

${verificationUrl}

This verification link will expire in 24 hours. If you didn't request this email, you can safely ignore it.

This email was sent by ENS Notifications. If you have any questions, please contact support.`,
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
    <h1 style="color: #111827; font-size: 24px; margin-top: 0; margin-bottom: 20px;">Verify your email address</h1>
    
    <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
      Thank you for signing up for ENS notifications! Please verify your email address by clicking the button below.
    </p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificationUrl}" 
         style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; margin-bottom: 10px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin-top: 0;">
      <a href="${verificationUrl}" style="color: #2563eb; text-decoration: underline;">${verificationUrl}</a>
    </p>
    
    <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        This verification link will expire in 24 hours. If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  </div>
  
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
    This email was sent by ENS Notifications. If you have any questions, please contact support.
  </p>
</body>
</html>
        `.trim(),
      },
    ],
  }

  const result = yield* sendMailV3(apiKey, emailContent)

  logger.info('Verification email sent', {
    to: toEmail,
    verificationUrl,
  })

  return ok(result)
})
