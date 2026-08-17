import { vValidator } from '@hono/valibot-validator'
import { match, P } from 'ts-pattern'
import * as v from 'valibot'
import { requireAuth } from '#app/middleware/auth.js'
import { createJWT, createNonce } from '#services/auth/index.js'
import { ethAddress, hex } from '#utils/validation.js'
import { injectDb } from '../../middleware/database'
import { injectEthClient } from '../../middleware/eth'
import { createApp, internalServerError } from '../../middleware/hono'

export default createApp()
  .basePath('/auth')
  .post('/nonce', async (c) => {
    const nonce = await createNonce(c.env)

    if (nonce.isErr()) {
      return c.json({ error: 'Failed to create nonce' }, 500)
    }

    return c.json({ nonce: nonce.value }, 200)
  })
  .post(
    '/login',
    vValidator(
      'json',
      v.object({
        address: ethAddress,
        message: v.string(),
        signature: hex,
        nonce: v.string(),
      }),
    ),
    injectEthClient,
    injectDb,
    async (c) => {
      const { address, message, signature, nonce } = c.req.valid('json')

      const jwt = await createJWT({
        env: c.env,
        client: c.var.ethClient,
        db: c.var.db,
        address: address,
        message,
        signature,
        nonce,
      })

      if (jwt.isErr()) {
        return match(jwt.error)

          .with({ _tag: 'INVALID_SIGNATURE' }, () =>
            c.json({ error: 'Invalid signature' }, 400),
          )
          .with({ _tag: 'INVALID_NONCE' }, () =>
            c.json({ error: 'Invalid nonce' }, 400),
          )
          .with({ _tag: 'INVALID_DOMAIN' }, () =>
            c.json({ error: 'Invalid SIWE domain' }, 400),
          )
          .with({ _tag: 'INVALID_URI' }, () =>
            c.json({ error: 'Invalid SIWE uri' }, 400),
          )
          .with({ _tag: 'SIWE_PARSE_ERROR' }, () =>
            c.json({ error: 'Invalid SIWE message' }, 400),
          )
          .with(
            {
              _tag: P.union(
                'DATABASE_ERROR',
                'KV_ERROR',
                'SIGN_JWT_ERROR',
                'SIWE_VERIFY_ERROR',
              ),
            },
            (error) => internalServerError(c, error),
          )
          .exhaustive()
      }

      return c.json({ token: jwt.value })
    },
  )
  .get('/me', ...requireAuth, async (c) => {
    return c.json({ address: c.var.address })
  })
