type ErrorLike = {
  readonly shortMessage?: string
  readonly message?: string
  readonly details?: string
  readonly metaMessages?: readonly string[]
  readonly cause?: unknown
}

const uniq = (arr: readonly string[]): readonly string[] =>
  Array.from(new Set(arr.map((entry) => entry.trim()).filter(Boolean)))

const cap = (text: string, max = 4000): string =>
  text.length > max ? `${text.slice(0, max)}\n…(truncated)` : text

const trimErrorDetails = (message: string): string => {
  const markers = [
    '\nRequest Arguments:',
    '\nContract Call:',
    '\nDocs:',
    '\nDetails:',
    '\nMeta Messages:',
  ]
  const trimmed = markers.reduce((current, marker) => {
    const index = current.indexOf(marker)
    return index !== -1 ? current.slice(0, index).trim() : current
  }, message)

  return trimmed
    .replace(/^Transaction Failed\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

const getErrorLike = (error: unknown): ErrorLike | null => {
  if (!error || typeof error !== 'object') return null
  return error as ErrorLike
}

const collectErrorStrings = (error: unknown): readonly string[] => {
  const errorLike = getErrorLike(error)
  if (!errorLike) return []

  const messages: readonly string[] = [
    ...(errorLike.shortMessage ? [errorLike.shortMessage] : []),
    ...(errorLike.message ? [errorLike.message] : []),
    ...(errorLike.details ? [errorLike.details] : []),
    ...(errorLike.metaMessages?.length ? errorLike.metaMessages : []),
  ]

  return errorLike.cause
    ? [...messages, ...collectErrorStrings(errorLike.cause)]
    : messages
}

const findFirstValue = (
  error: unknown,
  key: keyof ErrorLike,
): string | undefined => {
  const errorLike = getErrorLike(error)
  if (!errorLike) return undefined
  if (errorLike[key]) return errorLike[key] as string
  if (errorLike.cause) return findFirstValue(errorLike.cause, key)
  return undefined
}

export const getTransactionErrorInfo = (
  error: unknown,
): { readonly summary: string; readonly details: string | undefined } => {
  const messages = collectErrorStrings(error)
  const uniqueMessages = uniq(messages)
  const detailsText = uniqueMessages.length
    ? cap(uniqueMessages.join('\n\n'))
    : undefined
  const combined = uniqueMessages.join(' ').toLowerCase()

  if (combined.includes('user rejected') || combined.includes('user denied')) {
    return {
      summary: 'Transaction rejected in wallet.',
      details: detailsText,
    }
  }

  if (combined.includes('insufficient funds')) {
    return {
      summary: 'Insufficient funds to complete the transaction.',
      details: detailsText,
    }
  }

  const messagesText = messages.join('\n')
  const revertReason =
    messagesText.match(/execution reverted(?::\s*([^\n.]+))?/i)?.[1]?.trim() ??
    messagesText.match(/reason string\s+'([^']+)'/i)?.[1]?.trim()
  const addPeriod = (s: string): string => (/[.!?]$/.test(s) ? s : `${s}.`)
  if (revertReason !== undefined) {
    const summary = revertReason
      ? addPeriod(`Execution reverted: ${revertReason}`)
      : 'Transaction reverted by the contract.'
    return {
      summary,
      details: detailsText,
    }
  }

  const shortMessage = findFirstValue(error, 'shortMessage')
  const message = findFirstValue(error, 'message')
  const summary = shortMessage || (message ? trimErrorDetails(message) : null)

  return {
    summary: summary || 'Transaction failed. Please try again.',
    details: detailsText,
  }
}
