import { describe, expect, it } from 'vitest'
import { classifyDeliveryError } from './classifier'

describe('classifyDeliveryError', () => {
  describe('email', () => {
    it('classifies invalid email as hard_bounce', () => {
      const result = classifyDeliveryError(
        'email',
        'The email address is invalid',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies non-existent address as hard_bounce', () => {
      const result = classifyDeliveryError('email', 'Mailbox does not exist')
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies unverified sender as account_error', () => {
      const result = classifyDeliveryError(
        'email',
        'Sender not verified for this domain',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies 429 as rate_limit with 300s delay', () => {
      const result = classifyDeliveryError(
        'email',
        'SendGrid API returned status 429',
      )
      expect(result.category).toBe('rate_limit')
      expect(result.delaySeconds).toBe(300)
    })

    it('classifies "too many requests" as rate_limit', () => {
      const result = classifyDeliveryError(
        'email',
        'Too many requests, please retry later',
      )
      expect(result.category).toBe('rate_limit')
    })

    it('classifies unauthorized as account_error', () => {
      const result = classifyDeliveryError(
        'email',
        'The provided authorization grant is unauthorized',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies forbidden as account_error', () => {
      const result = classifyDeliveryError('email', 'Access forbidden')
      expect(result.category).toBe('account_error')
    })

    it('classifies suspended as account_error', () => {
      const result = classifyDeliveryError(
        'email',
        'Account suspended due to policy violation',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies 500 status as transient with 1hr delay', () => {
      const result = classifyDeliveryError(
        'email',
        'SendGrid API returned status 500',
      )
      expect(result.category).toBe('transient')
      expect(result.delaySeconds).toBe(3600)
    })

    it('classifies 503 status as transient', () => {
      const result = classifyDeliveryError(
        'email',
        'SendGrid API returned status 503',
      )
      expect(result.category).toBe('transient')
    })

    it('classifies timeout as transient', () => {
      const result = classifyDeliveryError('email', 'Request timeout after 30s')
      expect(result.category).toBe('transient')
    })

    it('classifies fetch failure as transient', () => {
      const result = classifyDeliveryError(
        'email',
        'fetch failed: Connection refused',
      )
      expect(result.category).toBe('transient')
    })

    it('classifies SENDGRID_API_REQUEST_ERROR as transient', () => {
      const result = classifyDeliveryError(
        'email',
        'SENDGRID_API_REQUEST_ERROR: network error',
      )
      expect(result.category).toBe('transient')
    })

    it('classifies unrecognized error as unknown', () => {
      const result = classifyDeliveryError(
        'email',
        'Something completely unexpected happened',
      )
      expect(result.category).toBe('unknown')
    })
  })

  describe('telegram', () => {
    it('classifies "chat not found" as hard_bounce', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Bad Request: chat not found',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies "bot was blocked" as hard_bounce', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Forbidden: bot was blocked by the user',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies "user is deactivated" as hard_bounce', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Forbidden: user is deactivated',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies PEER_ID_INVALID as hard_bounce', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Bad Request: PEER_ID_INVALID',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies Too Many Requests with retry_after as rate_limit', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Too Many Requests: retry after 30',
      )
      expect(result.category).toBe('rate_limit')
      expect(result.delaySeconds).toBe(60) // max(30, 60) = 60
    })

    it('classifies Too Many Requests with large retry_after', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Too Many Requests: retry after 120',
      )
      expect(result.category).toBe('rate_limit')
      expect(result.delaySeconds).toBe(120) // max(120, 60) = 120
    })

    it('classifies Too Many Requests without retry_after', () => {
      const result = classifyDeliveryError('telegram', 'Too Many Requests')
      expect(result.category).toBe('rate_limit')
      expect(result.delaySeconds).toBe(60) // max(0, 60) = 60
    })

    it('classifies Unauthorized as account_error', () => {
      const result = classifyDeliveryError('telegram', 'Unauthorized')
      expect(result.category).toBe('account_error')
    })

    it('classifies bot token error as account_error', () => {
      const result = classifyDeliveryError(
        'telegram',
        'Invalid bot token provided',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies Bad Gateway as transient', () => {
      const result = classifyDeliveryError('telegram', 'Bad Gateway')
      expect(result.category).toBe('transient')
      expect(result.delaySeconds).toBe(3600)
    })

    it('classifies Internal Server Error as transient', () => {
      const result = classifyDeliveryError('telegram', 'Internal Server Error')
      expect(result.category).toBe('transient')
    })

    it('classifies unrecognized error as unknown', () => {
      const result = classifyDeliveryError('telegram', 'Something weird')
      expect(result.category).toBe('unknown')
    })
  })

  describe('push', () => {
    it('classifies 410 Gone as hard_bounce', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 410 Gone',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies 404 as hard_bounce', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 404 Not Found',
      )
      expect(result.category).toBe('hard_bounce')
    })

    it('classifies 429 as rate_limit', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 429 Too Many Requests',
      )
      expect(result.category).toBe('rate_limit')
      expect(result.delaySeconds).toBe(300)
    })

    it('classifies 401 as account_error', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 401 Unauthorized',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies 403 as account_error', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 403 Forbidden',
      )
      expect(result.category).toBe('account_error')
    })

    it('classifies 500 as transient', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 500 Internal Server Error',
      )
      expect(result.category).toBe('transient')
      expect(result.delaySeconds).toBe(3600)
    })

    it('classifies 502 as transient', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: 502 Bad Gateway',
      )
      expect(result.category).toBe('transient')
    })

    it('classifies timeout as transient', () => {
      const result = classifyDeliveryError(
        'push',
        'Push delivery failed: timeout',
      )
      expect(result.category).toBe('transient')
    })

    it('classifies unrecognized error as unknown', () => {
      const result = classifyDeliveryError('push', 'Something unexpected')
      expect(result.category).toBe('unknown')
    })
  })

  describe('unknown channel', () => {
    it('returns unknown for unsupported channel', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing unsupported channel type intentionally
      const result = classifyDeliveryError('sms' as any, 'Some error')
      expect(result.category).toBe('unknown')
    })
  })
})
