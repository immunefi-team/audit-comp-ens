import { createMiddleware } from 'hono/factory'
import { jwt as honoJwt } from 'hono/jwt'
import * as v from 'valibot'
import type { BaseEnv, Variables } from '#app/middleware/hono.js'
import { AuthPayload } from '#core/auth/jwt.js'

export const requireJWT = createMiddleware<BaseEnv>(async (c, next) => {
  const jwtMiddleware = honoJwt({
    secret: c.env.JWT_SECRET,
    alg: 'HS256',
  })

  return jwtMiddleware(c, next)
})

export const verifyJWT = createMiddleware<
  BaseEnv &
    Variables<{
      user_id: string
      address: string
    }>
>(async (c, next) => {
  const payload = v.safeParse(AuthPayload, c.get('jwtPayload'))

  if (!payload.success) {
    return c.json({ error: 'Invalid JWT payload' }, 401)
  }

  c.set('address', payload.output.address)
  c.set('user_id', payload.output.user_id)

  await next()
})

export const requireAuth = [requireJWT, verifyJWT] as const
