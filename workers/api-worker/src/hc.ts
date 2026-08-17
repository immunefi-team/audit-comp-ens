import type { hc } from 'hono/client'
import app from './app'

const appRouter = app

export type AppRouter = typeof appRouter

export type Client = ReturnType<typeof hc<typeof appRouter>>
