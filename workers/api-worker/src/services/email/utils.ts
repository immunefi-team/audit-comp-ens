import { ResultFn } from '@ens-apps/utils/neverthrow'
import type { MailContent, MailJSON } from '@sendgrid/helpers/classes/mail'
import { fromPromise, ok } from 'neverthrow'
import * as v from 'valibot'
import { createIntoError, error } from '#utils/result.js'
import { parseIntoResult } from '#utils/validation.js'

const BASE_URL = 'https://api.sendgrid.com'

const SendGridErrorResponseSchema = v.object({
  errors: v.array(
    v.object({
      message: v.string(),
      field: v.optional(v.string()),
      help: v.optional(v.string()),
    }),
  ),
})

export type MailJSONRequired = Omit<MailJSON, 'content'> &
  ({ template_id: string } | { content: MailContent[] & { 0: MailContent } })

export const sendMailV3 = ResultFn(async function* (
  apiKey: string,
  emailData: MailJSONRequired,
) {
  const url = new URL(`${BASE_URL}/v3/mail/send`)

  const response = yield* fromPromise(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(emailData),
    }),
    createIntoError('SENDGRID_API_REQUEST_ERROR'),
  )

  // SendGrid returns 202 on success with no body, or error status codes with error body
  if (response.status === 202) {
    return ok({
      message: 'success',
      statusCode: response.status,
    })
  }

  // Parse error response
  const json = yield* fromPromise(
    response.json(),
    createIntoError('SENDGRID_API_RESPONSE_PARSE_ERROR'),
  )

  const parsedResponse = yield* parseIntoResult(
    SendGridErrorResponseSchema,
    json,
    {
      code: 'SENDGRID_API_RESPONSE_PARSE_ERROR',
      message: 'Failed to parse SendGrid API response',
    },
  )

  // If we get errors array, return them
  if ('errors' in parsedResponse && parsedResponse.errors.length > 0) {
    const firstError = parsedResponse.errors[0]
    return error({
      code: 'SENDGRID_API_ERROR',
      message: firstError.message,
      field: firstError.field,
      help: firstError.help,
      statusCode: response.status,
    })
  }

  // Fallback error if status is not 202
  return error({
    code: 'SENDGRID_API_ERROR',
    message: `SendGrid API returned status ${response.status}`,
    statusCode: response.status,
  })
})
