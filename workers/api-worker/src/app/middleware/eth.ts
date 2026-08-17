import { createMiddleware } from 'hono/factory'
import { createEnsClient, type ViemClient } from '#core/eth/client.js'
import { logger } from '#utils/logger.js'
import type { BaseEnv, Variables } from './hono'

export type InjectEthClientContext = Variables<{
  ethClient: ViemClient
}>

export const injectEthClient = createMiddleware<
  BaseEnv & InjectEthClientContext
>(async (c, next) => {
  const ethClient = createEnsClient(c.env)

  if (ethClient.isErr()) {
    logger.error('Failed to create ENS client', {
      error: ethClient.error,
      path: c.req.path,
      method: c.req.method,
    })
    return c.json(
      {
        error: 'SERVER_NOT_AVAILABLE',
      },
      500,
    )
  }

  c.set('ethClient', ethClient.value)

  await next()
})
