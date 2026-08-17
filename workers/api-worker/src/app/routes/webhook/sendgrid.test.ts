import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn()
  const mockDb = {
    query: {
      userChannels: {
        findFirst,
      },
    },
  }

  return {
    findFirst,
    getDatabase: vi.fn(() => mockDb),
  }
})

vi.mock('#core/database/index.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#core/database/index.js')>()
  return {
    ...actual,
    getDatabase: mocks.getDatabase,
  }
})

import sendgridApp from './sendgrid'

const payload = JSON.stringify([
  {
    email: 'test@example.com',
    event: 'bounce',
    timestamp: 1_750_000_000,
  },
])

const toBase64 = (value: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))

const createSignature = async (body: string, timestamp: string) => {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const publicKey = (await crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey,
  )) as ArrayBuffer
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(timestamp + body),
  )

  return {
    publicKey: toBase64(publicKey),
    signature: toBase64(signature),
  }
}

const requestWebhook = (
  env: CloudflareBindings,
  body: string,
  headers: Record<string, string> = {},
) =>
  sendgridApp.request(
    '/sendgrid/events',
    {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    },
    env,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(undefined)
})

describe('POST /sendgrid/events', () => {
  it.each([
    undefined,
    '',
    '   ',
    '\t\n',
  ])('fails closed without a verification key (%s)', async (verificationKey) => {
    const env = {
      SENDGRID_WEBHOOK_VERIFICATION_KEY: verificationKey,
    } as CloudflareBindings

    const response = await requestWebhook(env, 'not-json')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(mocks.getDatabase).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a malformed configured key as a server error without database work', async () => {
    const env = {
      SENDGRID_WEBHOOK_VERIFICATION_KEY: btoa('not an SPKI key'),
    } as CloudflareBindings

    const response = await requestWebhook(env, payload, {
      'X-Twilio-Email-Event-Webhook-Signature': btoa('signature'),
      'X-Twilio-Email-Event-Webhook-Timestamp': '1750000000',
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(mocks.getDatabase).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects missing signature headers without database work', async () => {
    const signed = await createSignature(payload, '1750000000')
    const env = {
      SENDGRID_WEBHOOK_VERIFICATION_KEY: signed.publicKey,
    } as CloudflareBindings

    const response = await requestWebhook(env, payload)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Missing signature headers',
    })
    expect(mocks.getDatabase).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a mismatched signed payload without database work', async () => {
    const timestamp = '1750000000'
    const signed = await createSignature(payload, timestamp)
    const env = {
      SENDGRID_WEBHOOK_VERIFICATION_KEY: signed.publicKey,
    } as CloudflareBindings

    const response = await requestWebhook(env, `${payload} `, {
      'X-Twilio-Email-Event-Webhook-Signature': signed.signature,
      'X-Twilio-Email-Event-Webhook-Timestamp': timestamp,
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid signature' })
    expect(mocks.getDatabase).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('processes a valid signed payload', async () => {
    const timestamp = '1750000000'
    const signed = await createSignature(payload, timestamp)
    const env = {
      SENDGRID_WEBHOOK_VERIFICATION_KEY: ` \t${signed.publicKey}\n `,
    } as CloudflareBindings

    const response = await requestWebhook(env, payload, {
      'X-Twilio-Email-Event-Webhook-Signature': signed.signature,
      'X-Twilio-Email-Event-Webhook-Timestamp': timestamp,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.getDatabase).toHaveBeenCalledOnce()
    expect(mocks.findFirst).toHaveBeenCalledOnce()
  })
})
