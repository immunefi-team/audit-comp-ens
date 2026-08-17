export type ErrorTone = 'destructive' | 'secondary' | 'default'

export type ConnectErrorDisplay = {
  message: string
  tone: ErrorTone
}

// Per wagmi error name → message + alert tone.
const CONNECT_ERROR_BY_NAME: Record<string, ConnectErrorDisplay> = {
  ConnectorAlreadyConnectedError: {
    message:
      'This wallet is already connected. Please disconnect first or try a different wallet.',
    tone: 'secondary',
  },
  UserRejectedRequestError: {
    message:
      'Connection was rejected. Please approve the connection request in your wallet.',
    tone: 'default',
  },
  ResourceUnavailableRpcError: {
    message:
      'Network error. Please check your internet connection and try again.',
    tone: 'default',
  },
  SwitchChainError: {
    message:
      'Failed to switch network. Please try switching networks manually in your wallet.',
    tone: 'destructive',
  },
  ChainMismatchError: {
    message:
      'Network mismatch. Please ensure your wallet is connected to the correct network.',
    tone: 'destructive',
  },
  InsufficientFundsError: {
    message:
      'Insufficient funds for transaction fees. Please add more funds to your wallet.',
    tone: 'destructive',
  },
}

// Fallback matching on the (lowercased) error text when the name isn't known.
const CONNECT_ERROR_BY_TEXT: ReadonlyArray<{
  needles: string[]
  message: string
}> = [
  {
    needles: ['user rejected', 'user denied'],
    message:
      'Connection was rejected. Please approve the connection request in your wallet.',
  },
  {
    needles: ['network', 'rpc'],
    message: 'Network error. Please check your connection and try again.',
  },
  {
    needles: ['timeout', 'timed out'],
    message: 'Connection timed out. Please try again.',
  },
  {
    needles: ['already connected'],
    message: 'This wallet is already connected. Please try a different wallet.',
  },
  {
    needles: ['no provider', 'no wallet'],
    message:
      'No wallet detected. Please install a wallet extension and refresh the page.',
  },
  {
    needles: ['unsupported chain'],
    message:
      'Unsupported network. Please switch to a supported network in your wallet.',
  },
]

/**
 * Maps a wallet-connect error to a user-facing message + alert tone. Tries the
 * known wagmi error name first, then a lowercased-text match, then falls back to
 * the raw message. Pure — safe to call during render.
 */
export const describeConnectError = (
  error: Error | null,
): ConnectErrorDisplay => {
  if (!error) {
    return {
      message: 'An unknown error occurred while connecting',
      tone: 'destructive',
    }
  }

  const byName = CONNECT_ERROR_BY_NAME[error.name]
  if (byName) return byName

  const text = error.message?.toLowerCase() ?? ''
  const byText = CONNECT_ERROR_BY_TEXT.find(({ needles }) =>
    needles.some((needle) => text.includes(needle)),
  )
  if (byText) return { message: byText.message, tone: 'destructive' }

  return {
    message:
      error.message ||
      'An unexpected error occurred while connecting to your wallet',
    tone: 'destructive',
  }
}
