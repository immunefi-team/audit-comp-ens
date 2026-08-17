import { assert, describe, expect, it } from 'vitest'
import { generateToken, type QueryChannelRow, toPublicChannel } from './helpers'

const baseRow = {
  id: 'channel-id',
  status: 'verified',
  status_reason: null,
  verified_at: null,
  last_sent_at: null,
  last_bounce_at: null,
  last_verification_sent_at: null,
} satisfies Omit<QueryChannelRow, 'channel' | 'target' | 'data'>

describe('toPublicChannel', () => {
  it('maps email channel without endpointHash', async () => {
    const result = await toPublicChannel({
      ...baseRow,
      channel: 'email',
      target: 'test@example.com',
      data: null,
    })

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.label).toBe('test@example.com')
    expect('endpointHash' in result.value).toBe(false)
  })

  it('maps telegram channel without endpointHash', async () => {
    const result = await toPublicChannel({
      ...baseRow,
      channel: 'telegram',
      target: '12345',
      data: { username: 'ens_user' },
    })

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.label).toBe('@ens_user')
    expect('endpointHash' in result.value).toBe(false)
  })

  it('maps push channel with deterministic endpointHash', async () => {
    const result = await toPublicChannel({
      ...baseRow,
      channel: 'push',
      target: 'https://push.example.com/sub/123',
      data: { auth: 'auth', p256dh: 'p256dh', expirationTime: null },
    })

    assert(result.isOk(), 'result should be ok')

    assert(result.value.channel === 'push', 'channel should be push')
    expect(result.value.endpointHash).toBe(
      'c1858014ce0f52b202f1c8e38d6f0220c7de57d0ee157b8da1d9c08ca4a253a6',
    )
  })
})

describe('generateToken', () => {
  it('returns a lowercase hex token with expected length', () => {
    const token = generateToken()
    expect(token).toMatch(/^[0-9a-f]+$/)
    expect(token).toHaveLength(32)
  })

  it('returns different values across consecutive calls', () => {
    const first = generateToken()
    const second = generateToken()
    expect(first).not.toBe(second)
  })
})
