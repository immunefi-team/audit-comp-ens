import { sql } from 'drizzle-orm/sql'

export const randomUUIDv7 = sql`uuid_generate_v7()`
