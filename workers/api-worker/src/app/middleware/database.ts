import { createMiddleware } from 'hono/factory'
import { type Database, getDatabase } from '#core/database/index.js'
import type { BaseEnv, Variables } from './hono'

export type InjectDbContext = Variables<{
  db: Database
}>

export const injectDb = createMiddleware<BaseEnv & InjectDbContext>(
  async (c, next) => {
    const db = getDatabase(c.env)

    c.set('db', db)

    await next()
  },
)
