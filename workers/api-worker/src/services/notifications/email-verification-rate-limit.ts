import { KV_KEY } from '#core/kv/index.js'

export const EMAIL_VERIFICATION_RATE_LIMIT_MAX_SENDS = 3
export const EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_SECONDS = 60 * 60

type RateLimitWindow = {
  count: number
  windowStartMs: number
}

export type EmailVerificationRateLimitResult =
  | { isAllowed: true }
  | { isAllowed: false; retryAfterSeconds: number }

export const normalizeEmailForRateLimit = (email: string) =>
  email.trim().toLowerCase()

export const formatEmailVerificationRateLimitError = (
  retryAfterSeconds: number,
) => {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `Too many verification emails sent to this address. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}.`
}

export const checkAndConsumeEmailVerificationRateLimit = async (
  kv: KVNamespace,
  email: string,
): Promise<EmailVerificationRateLimitResult> => {
  const normalizedEmail = normalizeEmailForRateLimit(email)
  const key = KV_KEY.NOTIFICATIONS.EMAIL_VERIFICATION(normalizedEmail)
  const now = Date.now()
  const windowMs = EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_SECONDS * 1000

  // NOTE: non-atomic read-modify-write on KV.
  // Concurrent requests may both read the same count and increment past the limit.
  // Overshoot is bounded; a Durable Object is not warranted here.
  const raw = await kv.get(key)
  let state: RateLimitWindow | null = null

  if (raw) {
    try {
      state = JSON.parse(raw) as RateLimitWindow
    } catch {
      state = null
    }
  }

  if (!state || now - state.windowStartMs >= windowMs) {
    state = { count: 0, windowStartMs: now }
  }

  if (state.count >= EMAIL_VERIFICATION_RATE_LIMIT_MAX_SENDS) {
    const windowEndMs = state.windowStartMs + windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - now) / 1000))
    return { isAllowed: false, retryAfterSeconds }
  }

  state.count += 1
  await kv.put(key, JSON.stringify(state), {
    expirationTtl: EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_SECONDS,
  })

  return { isAllowed: true }
}
