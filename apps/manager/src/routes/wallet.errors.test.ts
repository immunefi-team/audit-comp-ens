import { describe, expect, it } from 'vitest'
import { describeConnectError } from './wallet.errors'

const errorWith = (name: string, message = '') => {
  const error = new Error(message)
  error.name = name
  return error
}

describe('describeConnectError', () => {
  it('maps a known wagmi error name to its message and tone', () => {
    expect(
      describeConnectError(errorWith('ConnectorAlreadyConnectedError')),
    ).toEqual({
      message:
        'This wallet is already connected. Please disconnect first or try a different wallet.',
      tone: 'secondary',
    })
    expect(
      describeConnectError(errorWith('UserRejectedRequestError')).tone,
    ).toBe('default')
    expect(describeConnectError(errorWith('SwitchChainError')).tone).toBe(
      'destructive',
    )
  })

  it('prefers the name match over the message text', () => {
    // name is known (secondary) even though the text would match a destructive rule
    const result = describeConnectError(
      errorWith('ConnectorAlreadyConnectedError', 'network rpc failure'),
    )
    expect(result.tone).toBe('secondary')
  })

  it('falls back to a text match when the name is unknown', () => {
    const result = describeConnectError(
      errorWith('SomeUnknownError', 'Request timed out while connecting'),
    )
    expect(result).toEqual({
      message: 'Connection timed out. Please try again.',
      tone: 'destructive',
    })
  })

  it('matches text case-insensitively', () => {
    expect(
      describeConnectError(errorWith('X', 'USER REJECTED the request')).message,
    ).toBe(
      'Connection was rejected. Please approve the connection request in your wallet.',
    )
  })

  it('falls back to the raw message when nothing matches', () => {
    const result = describeConnectError(errorWith('X', 'Totally novel failure'))
    expect(result).toEqual({
      message: 'Totally novel failure',
      tone: 'destructive',
    })
  })

  it('uses a generic message when an unknown error has no message', () => {
    expect(describeConnectError(errorWith('X', '')).message).toBe(
      'An unexpected error occurred while connecting to your wallet',
    )
  })

  it('handles a null error', () => {
    expect(describeConnectError(null)).toEqual({
      message: 'An unknown error occurred while connecting',
      tone: 'destructive',
    })
  })
})
