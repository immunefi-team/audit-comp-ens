import { TaggedError } from '@ens-apps/utils/neverthrow'
import { neonConfig } from '@neondatabase/serverless'
import { DrizzleError, DrizzleQueryError } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import { fromPromise, type ResultAsync } from 'neverthrow'
import * as schema from './schema'

// Overwrite the fetch endpoint for local development according to the proxy documentation https://github.com/TimoWilhelm/local-neon-http-proxy
neonConfig.fetchEndpoint = (host, port, options) =>
  host === 'db.localtest.me'
    ? `http://${host}:4444/sql`
    : typeof neonConfig.defaults.fetchEndpoint === 'function'
      ? neonConfig.defaults.fetchEndpoint(host, port, options)
      : neonConfig.defaults.fetchEndpoint

export const getDatabase = (env: CloudflareBindings) => {
  const db = drizzle(env.DATABASE_URL, {
    schema,
  })

  return db
}

export type Database = ReturnType<typeof getDatabase>

export class DatabaseError extends TaggedError('DATABASE_ERROR')<{
  cause: DrizzleQueryError | DrizzleError
}> {
  override get message() {
    return `Database error: ${this.cause.message ?? 'Unknown error'}`
  }
}

export const intoDbError = (err: unknown) => {
  const error =
    err instanceof DrizzleError || err instanceof DrizzleQueryError
      ? err
      : new Error('Unknown database error', {
          cause: err,
        })

  return new DatabaseError({
    cause: error,
  })
}

export const intoDbResult = <T>(
  promise: PromiseLike<T>,
): ResultAsync<T, DatabaseError> => {
  return fromPromise(promise, intoDbError)
}

export const TABLE: {
  [K in keyof typeof schema as (typeof schema)[K] extends AnyPgTable
    ? K
    : never]: (typeof schema)[K]
} = schema

export * as schema from './schema/index.js'
