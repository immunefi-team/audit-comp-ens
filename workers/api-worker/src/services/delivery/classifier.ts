import type { FailureCategory } from '#types/delivery.js'

type DeliveryChannel = 'email' | 'push' | 'telegram'

export type ClassificationResult = {
  category: FailureCategory
  delaySeconds?: number
}

// classifies delivery errors based on channel-specific provider response patterns
export function classifyDeliveryError(
  channel: DeliveryChannel,
  error: string,
): ClassificationResult {
  switch (channel) {
    case 'email':
      return classifyEmailError(error)
    case 'telegram':
      return classifyTelegramError(error)
    case 'push':
      return classifyPushError(error)
    default:
      return { category: 'unknown' }
  }
}

function classifyEmailError(error: string): ClassificationResult {
  // hard bounce: invalid recipient, non-existent address
  if (
    /invalid.*email|email.*invalid/i.test(error) ||
    /does not exist/i.test(error)
  ) {
    return { category: 'hard_bounce' }
  }

  // rate limit: HTTP 429 or explicit rate messaging
  if (/status 429/.test(error) || /too many/i.test(error)) {
    return { category: 'rate_limit', delaySeconds: 300 }
  }

  // account error: auth/permission issues, sender/domain not verified
  if (
    /unauthorized/i.test(error) ||
    /forbidden/i.test(error) ||
    /suspended/i.test(error) ||
    /not.*verified/i.test(error)
  ) {
    return { category: 'account_error' }
  }

  // transient: server errors, network issues
  if (
    /status 5\d\d/.test(error) ||
    /timeout/i.test(error) ||
    /fetch failed/i.test(error) ||
    /SENDGRID_API_REQUEST_ERROR/.test(error)
  ) {
    return { category: 'transient', delaySeconds: 3600 }
  }

  return { category: 'unknown' }
}

function classifyTelegramError(error: string): ClassificationResult {
  // hard bounce: chat gone, bot blocked, user deactivated
  if (
    /chat not found/i.test(error) ||
    /bot was blocked/i.test(error) ||
    /user is deactivated/i.test(error) ||
    /PEER_ID_INVALID/i.test(error)
  ) {
    return { category: 'hard_bounce' }
  }

  // rate limit: Telegram explicitly says "Too Many Requests"
  if (/Too Many Requests/i.test(error)) {
    const retryMatch = error.match(/retry after (\d+)/i)
    const parsedDelay = retryMatch ? parseInt(retryMatch[1], 10) : 0
    return {
      category: 'rate_limit',
      delaySeconds: Math.max(parsedDelay, 60),
    }
  }

  // account error: bot token issues
  if (/Unauthorized/i.test(error) || /bot token/i.test(error)) {
    return { category: 'account_error' }
  }

  // transient: gateway / server errors
  if (
    /Bad Gateway/i.test(error) ||
    /Internal Server Error/i.test(error) ||
    /Service Unavailable/i.test(error)
  ) {
    return { category: 'transient', delaySeconds: 3600 }
  }

  return { category: 'unknown' }
}

function classifyPushError(error: string): ClassificationResult {
  // hard bounce: subscription expired (410 Gone) or not found (404)
  if (/410/.test(error) || /Gone/i.test(error) || /404/.test(error)) {
    return { category: 'hard_bounce' }
  }

  // rate limit
  if (/429/.test(error)) {
    return { category: 'rate_limit', delaySeconds: 300 }
  }

  // account error: VAPID auth issues
  if (/401/.test(error) || /403/.test(error)) {
    return { category: 'account_error' }
  }

  // transient: server errors
  if (
    /5\d{2}/.test(error) ||
    /timeout/i.test(error) ||
    /Service Unavailable/i.test(error)
  ) {
    return { category: 'transient', delaySeconds: 3600 }
  }

  return { category: 'unknown' }
}
